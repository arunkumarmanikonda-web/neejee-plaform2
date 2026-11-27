import test from 'node:test';
import assert from 'node:assert/strict';
import { bookDispatch, dispatchPayment, reviewable, type Booking, type Waybill, type DispatchStore, type DispatchSnapshot } from '../../lib/shipping/shiprocket-dispatch';

function fixture() {
  let row:DispatchSnapshot={id:'o',status:'PLACED',paymentMethod:'COD',paymentStatus:'PENDING',awbNumber:null,courier:null,shiprocketShipmentId:null,
    shiprocketOrderId:null,shiprocketPaymentMode:null,shiprocketStage:null,shiprocketClaimedAt:null};
  let bookings=0,assignments=0;
  let booking:Booking={ok:true,shipmentId:'84',carrierOrderId:'12'};
  let waybill:Waybill={ok:true,awb:'AWB718',courier:'Test'};
  const store:DispatchStore={
    read:async()=>({...row}),
    change:async(s,c,eligible)=>{
      if(s.shiprocketStage!==row.shiprocketStage || s.shiprocketClaimedAt!==row.shiprocketClaimedAt || s.shiprocketShipmentId!==row.shiprocketShipmentId ||
        (eligible && !dispatchPayment(row))) return false;
      row={...row,...c};return true;
    },
    markPacked:async()=>{if(dispatchPayment(row))row.status='PACKED';},
  };
  const carrier={create:async()=>{bookings++;return booking;},assign:async(id:string)=>{assert.equal(id,row.shiprocketShipmentId);assignments++;return waybill;}};
  return {run:()=>bookDispatch(store,carrier),row:()=>row,change:(patch:Partial<DispatchSnapshot>)=>Object.assign(row,patch),counts:()=>[bookings,assignments],
    booking:(v:Booking)=>{booking=v;},waybill:(v:Waybill)=>{waybill=v;}};
}
test('prepayment requires settlement, COD collects only outstanding amounts and terminal orders are ineligible',()=>{
  for (const status of ['PLACED','CONFIRMED','PACKED']) {
    assert.equal(dispatchPayment({status,paymentMethod:'COD',paymentStatus:'PENDING'}),'COD');
    assert.equal(dispatchPayment({status,paymentMethod:'COD',paymentStatus:'PAID'}),'Prepaid');
    assert.equal(dispatchPayment({status,paymentMethod:'RAZORPAY',paymentStatus:'PAID'}),'Prepaid');
    assert.equal(dispatchPayment({status,paymentMethod:'RAZORPAY',paymentStatus:'PENDING'}),null);
    for(const paymentStatus of ['REFUNDED','PARTIALLY_REFUNDED','FAILED']) assert.equal(dispatchPayment({status,paymentMethod:'COD',paymentStatus}),null);
  }
  for(const status of ['CANCELLED','SHIPPED','DELIVERED','RETURNED','REFUNDED']) assert.equal(dispatchPayment({status,paymentMethod:'COD',paymentStatus:'PENDING'}),null);
});
test('parallel clicks and repeated submit create only one booking and one assignment',async()=>{
  const f=fixture();await Promise.all([f.run(),f.run(),f.run()]);assert.deepEqual(f.counts(),[1,1]);assert.equal(f.row().status,'PACKED');
  assert.equal((await f.run()).awb,'AWB718');assert.deepEqual(f.counts(),[1,1]);
});
test('a retry after a known AWB refusal reuses the saved carrier shipment',async()=>{
  const f=fixture();f.waybill({ok:false,safeToRetry:true,error:'rate limit'});assert.equal((await f.run()).code,503);
  assert.equal(f.row().shiprocketShipmentId,'84');assert.equal(f.row().shiprocketOrderId,'12');assert.equal(f.row().shiprocketStage,null);
  f.waybill({ok:true,awb:'AWB880',courier:'Test'});await f.run();assert.deepEqual(f.counts(),[1,2]);
});
test('ambiguous bookings and ambiguous waybills cannot replay automatically',async()=>{
  const b=fixture();b.booking({ok:false,safeToRetry:false,error:'timeout'});await b.run();await b.run();assert.deepEqual(b.counts(),[1,0]);assert.ok(reviewable(b.row()));
  const a=fixture();a.waybill({ok:false,safeToRetry:false,error:'timeout'});await a.run();await a.run();assert.deepEqual(a.counts(),[1,1]);assert.equal(a.row().shiprocketShipmentId,'84');
});
test('legacy AWB and unresolved predeployment orders are not submitted; stale claims need a dashboard check',async()=>{
  const f=fixture();f.change({awbNumber:'AWB100',status:'DELIVERED'});await f.run();assert.deepEqual(f.counts(),[0,0]);
  const g=fixture();g.change({shiprocketStage:'CHECK_BOOKING'});await g.run();assert.deepEqual(g.counts(),[0,0]);
  const start=100; assert.equal(reviewable({shiprocketStage:'BOOKING',shiprocketClaimedAt:new Date(start)},start+299999),false);
  assert.equal(reviewable({shiprocketStage:'BOOKING',shiprocketClaimedAt:new Date(start)},start+300000),true);
});

test('an order paid after COD booking cannot receive a COD waybill',async()=>{
  const f=fixture();
  f.waybill({ok:false,safeToRetry:true,error:'rate limit'});
  await f.run();
  assert.equal(f.row().shiprocketPaymentMode,'COD');
  f.change({paymentStatus:'PAID'});
  assert.equal((await f.run()).code,409);
  assert.equal(f.row().shiprocketStage,'CHECK_PAYMENT');
  assert.deepEqual(f.counts(),[1,1]);
});
test('provider client preserves paise, carrier IDs and distinguishes refusal from an unknown response', async t=>{
  const {createShipment,generateAwb}=await import('../../lib/shiprocket');
  const previousEmail=process.env.SHIPROCKET_EMAIL, previousPassword=process.env.SHIPROCKET_PASSWORD;
  process.env.SHIPROCKET_EMAIL='test@example.invalid'; process.env.SHIPROCKET_PASSWORD='local-fixture';
  t.after(()=>{
    if(previousEmail===undefined) delete process.env.SHIPROCKET_EMAIL; else process.env.SHIPROCKET_EMAIL=previousEmail;
    if(previousPassword===undefined) delete process.env.SHIPROCKET_PASSWORD; else process.env.SHIPROCKET_PASSWORD=previousPassword;
  });
  const payloads:Array<Record<string,unknown>>=[];
  const replies:Array<() => Response>=[
    ()=>Response.json({token:'fixture-token'}),()=>Response.json({order_id:15,shipment_id:44}),
    ()=>Response.json({awb_assign_status:1,response:{data:{awb_code:'ABC445',courier_name:'Fixture'}}}),
    ()=>Response.json({}, {status:429}),()=>Response.json({status:'received'}),
    ()=>{throw new Error('connection lost');},
  ];
  t.mock.method(globalThis,'fetch',async (_url:string,init:RequestInit)=>{
    payloads.push(JSON.parse(String(init.body))); return replies.shift()!();
  });
  const item={name:'Saree',sku:'TEST',quantity:1,pricePaise:12345};
  const args={orderNumber:'FIXTURE',orderDate:new Date('2026-11-27'),customerName:'Test Person',customerPhone:'123',customerEmail:'fixture@example.invalid',
    billing:{address:'Test',city:'Test',state:'Test',pincode:'000000'},items:[item],totalPaise:12491,shippingPaise:150,giftWrapPaise:50,discountPaise:54,paymentMethod:'Prepaid' as const};
  assert.deepEqual(await createShipment(args),{ok:true,shipmentId:'44',carrierOrderId:'15'});
  assert.equal(payloads[1].sub_total,124.91);assert.equal(payloads[1].shipping_charges,1.5);
  assert.equal(payloads[1].total_discount,0.54);assert.equal((payloads[1].order_items as Array<{selling_price:number}>)[0].selling_price,123.45);
  assert.deepEqual(await generateAwb('44'),{ok:true,awb:'ABC445',courier:'Fixture'});
  const refused=await generateAwb('44'), unknown=await createShipment(args), interrupted=await generateAwb('44');
  assert.ok(!refused.ok&&refused.safeToRetry);
  assert.ok(!unknown.ok&&!unknown.safeToRetry);
  assert.ok(!interrupted.ok&&!interrupted.safeToRetry);
  assert.equal(replies.length,0);
});
