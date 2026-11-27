// Read-only by default. Run via tsx. An explicit --apply writes only verified matches.
import { PrismaClient } from '@prisma/client';
import { orderShippingAddress } from '../lib/checkout/order-shipping-address';
const db = new PrismaClient();
async function main() {
  const apply = process.argv.includes('--apply');
  const counts = {checked:0,matched:0,unrecoverable:0,updated:0,changedConcurrently:0};
  let cursor: string | undefined;
  for (;;) {
    const orders: Array<{id:string; guestEmail:string|null; razorpayOrderId:string|null}> = await db.order.findMany({
      where:{ userId:null, addressId:null, ...(cursor ? {id:{gt:cursor}} : {}) },
      select:{id:true,guestEmail:true,razorpayOrderId:true}, orderBy:{id:'asc'}, take:100,
    });
    if (!orders.length) break;
    for (const order of orders) {
      cursor = order.id; counts.checked++;
      if (!order.guestEmail || !order.razorpayOrderId) { counts.unrecoverable++; continue; }
      const snapshots = await db.abandonedCart.findMany({
        where:{recoveredOrderId:order.id,razorpayOrderId:order.razorpayOrderId,email:{equals:order.guestEmail,mode:'insensitive'},userId:null},
        select:{itemsJson:true},take:2,
      });
      if (snapshots.length !== 1) { counts.unrecoverable++; continue; }
      let address;
      try {
        const data = JSON.parse(snapshots[0].itemsJson);
        if (data.session?.id || typeof data.contact?.email !== 'string' || data.contact.email.trim().toLowerCase() !== order.guestEmail.trim().toLowerCase()) {
          counts.unrecoverable++; continue;
        }
        address = orderShippingAddress(undefined,data.address,data.contact.phone);
      } catch { counts.unrecoverable++; continue; }
      counts.matched++;
      if (!apply) continue;
      const shipping = address;
      try {
        await db.$transaction(async tx => {
          const row = await tx.address.create({ data:shipping,select:{id:true} });
          const linked = await tx.order.updateMany({
            where:{id:order.id,userId:null,addressId:null,guestEmail:order.guestEmail,razorpayOrderId:order.razorpayOrderId},
            data:{addressId:row.id},
          });
          if (linked.count!==1) throw new Error('ORDER_CHANGED');
        });
        counts.updated++;
      } catch (err) {
        if (!(err instanceof Error) || err.message!=='ORDER_CHANGED') throw err;
        counts.changedConcurrently++;
      }
    }
  }
  console.log(JSON.stringify({mode:apply?'apply':'dry-run',...counts}));
}
main().catch(() => { console.error('Guest delivery reconciliation failed.');process.exitCode=1; }).finally(() => db.$disconnect());
