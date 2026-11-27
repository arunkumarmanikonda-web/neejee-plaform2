import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { createShipment, generateAwb, shiprocketConfigured } from '@/lib/shiprocket';
import { bookDispatch, dispatchPayment, reviewable, trackingLink, validAwb, validShipmentId, type DispatchSnapshot, type CarrierState, type DispatchStore } from '@/lib/shipping/shiprocket-dispatch';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
const select={id:true,status:true,paymentMethod:true,paymentStatus:true,awbNumber:true,courier:true,shiprocketShipmentId:true,shiprocketOrderId:true,shiprocketPaymentMode:true,shiprocketStage:true,shiprocketClaimedAt:true} as const;
const lookup=(key:string)=>({OR:[{id:key},{orderNumber:key}]});
const fail=(message:string,status:number)=>NextResponse.json({error:message},{status});
const stateWhere=(row:DispatchSnapshot)=>({id:row.id,shiprocketStage:row.shiprocketStage,shiprocketPaymentMode:row.shiprocketPaymentMode,shiprocketClaimedAt:row.shiprocketClaimedAt,shiprocketShipmentId:row.shiprocketShipmentId});
const eligibleWhere={status:{in:['PLACED','CONFIRMED','PACKED'] as ('PLACED'|'CONFIRMED'|'PACKED')[]},OR:[{paymentStatus:'PAID' as const},{paymentMethod:'COD',paymentStatus:'PENDING' as const}]};

export async function POST(_request:Request, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  const user=await getSession();
  if (!requireRole(user,['ADMIN','SUPER_ADMIN'])) return fail('Unauthorized',401);
  const order=await prisma.order.findFirst({where:lookup(params.id),include:{
    items:{include:{product:{select:{name:true,sku:true,hsnCode:true}},variant:{select:{sku:true,weight:true}}}},
    address:true,user:{select:{email:true,name:true}},
  }});
  if (!order) return fail('Order not found.',404);
  if (!order.awbNumber && !shiprocketConfigured()) return fail('Carrier credentials are not configured.',503);
  const store:DispatchStore={
    read:()=>prisma.order.findUnique({where:{id:order.id},select}),
    async change(snapshot,change,onlyIfEligible) {
      const protectWaybill=onlyIfEligible || !!change.awbNumber;
      const result=await prisma.order.updateMany({where:{
        ...stateWhere(snapshot),...(protectWaybill?{awbNumber:snapshot.awbNumber}:{}),
        ...(onlyIfEligible?{...eligibleWhere,paymentStatus:snapshot.paymentStatus as typeof order.paymentStatus,paymentMethod:snapshot.paymentMethod}:{}),
      },data:change});
      return result.count===1;
    },
    async markPacked(id,awb){await prisma.order.updateMany({where:{id,awbNumber:awb,...eligibleWhere},data:{status:'PACKED'}});},
  };
  try {
    const result=await bookDispatch(store,{assign:generateAwb,create:async method=>{
      const addr=order.address;
      if (!addr?.line1 || !addr.phone || !addr.pincode || !addr.city || !addr.state || (addr.country && !['IN','INDIA'].includes(addr.country.toUpperCase())))
        return {ok:false,safeToRetry:true,error:'This order needs a complete domestic shipping address.'};
      const discount=order.discount+order.pointsValue;
      const giftWrap=order.total+discount-order.subtotal-order.shipping;
      if (!order.items.length || order.total<0 || (!order.giftWrap && giftWrap!==0) || giftWrap<0)
        return {ok:false,safeToRetry:true,error:'Reconcile order charges before creating this shipment.'};
      return createShipment({
        orderNumber:order.orderNumber,orderDate:order.createdAt,
        customerName:addr.name||order.user?.name||order.guestName||'Customer',customerEmail:order.user?.email||order.guestEmail||'',customerPhone:addr.phone,
        billing:{address:[addr.line1,addr.line2].filter(Boolean).join(', '),city:addr.city,state:addr.state,pincode:addr.pincode},
        items:order.items.map(i=>({name:i.product.name,sku:i.variant?.sku||i.product.sku||i.productId,quantity:i.quantity,pricePaise:i.price,hsnCode:i.product.hsnCode||undefined})),
        totalPaise:order.total,discountPaise:discount,shippingPaise:order.shipping,giftWrapPaise:giftWrap,paymentMethod:method,
        weight:order.items.reduce((sum,i)=>sum+((i.variant?.weight||500)*i.quantity)/1000,0)||.5,
      });
    }});
    return NextResponse.json({success:result.code===200,message:result.message,shipmentId:result.shipmentId,
      ...(result.code!==200?{error:result.message}:{}),...(result.awb?{awb:{ok:true,awb:result.awb,courier:result.courier}}:{})},{status:result.code});
  } catch {return fail('Dispatch could not be confirmed. Refresh the order and check Shiprocket before retrying.',503);}
}

export async function PATCH(request:Request, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  const user=await getSession();
  if (!requireRole(user,['ADMIN','SUPER_ADMIN']) || !user) return fail('Unauthorized',401);
  const body=await request.json().catch(()=>null);
  if (body?.verified!==true || !['found','absent'].includes(body.action)) return fail('Confirm the dashboard check and select a result.',400);
  const order=await prisma.order.findFirst({where:lookup(params.id),select});
  if (!order) return fail('Order not found.',404);
  const expectedMode=dispatchPayment(order);
  const paymentMismatch=!!order.shiprocketShipmentId && !order.shiprocketStage && !!expectedMode && order.shiprocketPaymentMode!==expectedMode;
  if (!reviewable(order) && !paymentMismatch) return fail('This order has no unresolved carrier request ready for reconciliation.',409);
  const awb=(typeof body.awb==='string'?body.awb:'').trim();
  const sid=(typeof body.shipmentId==='string'?body.shipmentId:'').trim();
  if ((paymentMismatch || order.shiprocketStage==='CHECK_PAYMENT') && body.action!=='found') return fail('Verify the collection method on the saved carrier shipment.',400);
  if (body.action==='found' && expectedMode && body.carrierPaymentMode!==expectedMode) return fail('Confirm the carrier payment method matches the current order before resuming dispatch.',409);
  if (body.action==='absent' && (sid || awb)) return fail('Choose found to record a carrier reference.',400);
  if (body.action==='found' && (!validShipmentId(sid) || (order.shiprocketShipmentId && order.shiprocketShipmentId!==sid) || (awb && !validAwb(awb))))
    return fail('Enter the matching shipment ID and valid AWB if one has been assigned.',400);
  if (order.awbNumber && awb && order.awbNumber!==awb) return fail('The entered AWB differs from the existing tracking record.',409);
  const change:CarrierState={shiprocketStage:null,shiprocketClaimedAt:null};
  if (body.action==='found') {
    change.shiprocketShipmentId=sid;
    if (expectedMode) change.shiprocketPaymentMode=expectedMode;
    if (awb) {change.awbNumber=awb;change.trackingUrl=trackingLink(awb);}
  }
  try {
    const success=await prisma.$transaction(async tx=>{
      const updated=await tx.order.updateMany({where:{...stateWhere(order),awbNumber:order.awbNumber,paymentStatus:order.paymentStatus,paymentMethod:order.paymentMethod,status:order.status},data:change});
      if (!updated.count) return false;
      if (awb && dispatchPayment(order)) await tx.order.updateMany({where:{id:order.id,...eligibleWhere},data:{status:'PACKED'}});
      await tx.financeAuditLog.create({data:{action:'UPDATE',entityType:'CarrierReconciliation',entityId:order.id,
        userId:user.id,userRole:user.role,fullSnapshot:JSON.stringify({stage:order.shiprocketStage,result:body.action,carrierPaymentMode:change.shiprocketPaymentMode||null,shipmentId:change.shiprocketShipmentId||order.shiprocketShipmentId,awb:awb||null})}});
      return true;
    });
    return success?NextResponse.json({success:true}):fail('Dispatch changed. Refresh before reconciling.',409);
  } catch {return fail('Could not save. Verify that the shipment belongs only to this order.',409);}
}
