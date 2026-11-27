import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { reserveInventory } from '../../lib/inventory/reservations';

const origin = process.env.NEEJEE_LOCAL_CHECKOUT_TEST_URL || process.env.NEEJEE_LOCAL_COD_TEST_URL;
test('prepaid guest checkout holds stock and can refresh that hold before opening the gateway', { skip: !origin }, async () => {
  const local = (url: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname);
  assert.ok(local(origin!) && local(process.env.DATABASE_URL!), 'use a disposable local database and server');
  const db = new PrismaClient();
  const prefix = 'prepaid-fixture-' + randomUUID();
  const email = prefix + '@example.invalid';
  try {
    const category = await db.category.create({ data: { name: prefix, slug: prefix } });
    const product = await db.product.create({
      data: { name: 'Fixture lamp', slug: prefix, sku: prefix, categoryId: category.id, status: 'ACTIVE',
        mrp: 499900, sellingPrice: 499900, variants: { create: { sku: prefix+'-v', inventory: 1 } } },
      include: { variants: true },
    });
    const variantId = product.variants[0].id;
    const payload = {
      payment: 'RAZORPAY', shipping: 'STANDARD', items: [{ productId: product.id, variantId, quantity: 1 }],
      contact: { email, phone:'9000000000' },
      address: { name: prefix, line1: 'Fixture lane', city:'Jaipur', state:'Rajasthan', pincode:'302001', country:'India' },
    };
    const post = (path:string, data:object) => fetch(origin+path,{
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data),
    });
    const quote = await post('/api/checkout/quote',payload);
    assert.equal(quote.status,200);
    const {total} = await quote.json();
    const start = await post('/api/checkout',{...payload, expectedTotal:total});
    const checkout = await start.json();
    assert.equal(start.status,200,JSON.stringify(checkout));
    assert.equal(checkout.next,'payment');
    assert.equal(checkout.total,total);
    assert.ok(checkout.snapshotId && Date.parse(checkout.reservationExpiresAt)>Date.now());
    const refreshed = await reserveInventory(db,checkout.snapshotId,[{variantId,quantity:1}],30);
    assert.equal(refreshed.variantCount,1);

    const second = await post('/api/checkout',payload);
    assert.equal(second.status,409);
    assert.equal((await second.json()).code,'INVENTORY_CHANGED');
    assert.equal(await db.abandonedCart.count({ where:{email} }),1);
    assert.equal(await db.order.count({ where:{guestEmail:email} }),0);
    assert.equal((await db.variant.findUniqueOrThrow({where:{id:variantId}})).inventory,1);
  } finally {
    await db.abandonedCart.deleteMany({where:{email}});
    await db.variant.deleteMany({where:{sku:prefix+'-v'}});
    await db.product.deleteMany({where:{sku:prefix}});
    await db.category.deleteMany({where:{slug:prefix}});
    await db.$disconnect();
  }
});
