import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInvoiceAmounts, checkoutFee, includedGst, reconcileWebsiteOrder } from '../../lib/finance/checkout-tax';

const item = (productId:string, price:number, gstRate:number, quantity=1) =>
  ({productId,variantId:'v'+productId,price,quantity,total:price*quantity,hsnCode:'TEST',gstRate});
const inputs = [item('linen',10500,5),item('bowl',11200,12),item('jewellery',11800,18)];
const fee = (amount=0,gstRate=0) => ({ amount, gstRate, hsnCode:null });
const snapshot = {version:1,items:inputs, shipping:fee(1180,18),wrap:fee(1050,5),coupon:1500,points:777,total:33453};
const order = () => {
  const amounts=calculateInvoiceAmounts(snapshot);
  return {source:'WEB',paymentMethod:'RAZORPAY',paymentStatus:'PAID',subtotal:33500,discount:1500,pointsValue:777,shipping:1180,
    giftWrap:true,total:33453,tax:amounts.tax,checkoutTaxSnapshot:snapshot as unknown,createdAt:new Date('2026-02-01'),
    items:inputs.map(line=>({...line,product:{gstRate:28,hsnCode:'LATER',updatedAt:new Date('2026-03-01')}}))};
};
test('tax-inclusive merchandise, fees, coupon and points sum exactly to the collected value at mixed rates',()=>{
  const result=calculateInvoiceAmounts(snapshot);
  assert.equal(result.lines.reduce((s,l)=>s+l.discount,0),2277);
  assert.equal(result.lines.reduce((s,l)=>s+l.tax+l.taxable,0),33453);
  assert.equal(result.lines.length,5);
  for (const l of result.lines) assert.equal(l.tax,Math.round(l.total*l.gstRate/(100+l.gstRate)));
  assert.deepEqual(calculateInvoiceAmounts({...snapshot,items:[item('piece',10500,5)],shipping:fee(),wrap:fee(),coupon:0,points:0,total:10500}).lines[0],
    {kind:'product',amount:10500,discount:0,tax:500,taxable:10000,total:10500,gstRate:5,hsnCode:'TEST'});
});
test('stable one-paise allocation, zero-rated items, fractional rates and a fully discounted purchase',()=>{
  const tiny={version:1, items:[item('a',1,0),item('b',1,0.25),item('c',1,3)],shipping:fee(),wrap:fee(),coupon:1,points:1,total:1};
  const lines=calculateInvoiceAmounts(tiny).lines;
  assert.deepEqual(lines.slice(0,3).map(l=>l.total),[0,0,1]);
  const all=calculateInvoiceAmounts({...tiny,points:2,total:0});assert.equal(all.tax,0);assert.equal(all.lines.every(l=>l.total===0),true);
  assert.equal(includedGst(10025,0.25),25);
  const big=calculateInvoiceAmounts({...tiny,items:[item('a',850000000,5),item('b',950000000,5)],coupon:1300000001,points:0,total:499999999});
  assert.equal(big.lines[0].discount+big.lines[1].discount,1300000001);
});
test('catalogue changes and database relation reordering do not change a confirmed purchase',()=>{
  const source=order();source.items.reverse();
  const result=reconcileWebsiteOrder(source);assert.deepEqual(result.products.map(l=>l.gstRate),[18,12,5]);
  assert.deepEqual(result.products.map(l=>l.hsnCode),['TEST','TEST','TEST']);
  assert.deepEqual(result.fees.map(l=>l.kind),['shipping','wrap']);
});
test('paid and COD order values are reconciled, invalid snapshots and noncaptured orders need review',()=>{
  const source=order();
  const cod={...source,paymentMethod:'COD',paymentStatus:'PENDING'};
  assert.equal(reconcileWebsiteOrder(cod).snapshot.total,cod.total);
  for(const data of [{tax:0},{total:1},{subtotal:1},{discount:0},{pointsValue:0},{giftWrap:false},{shipping:1},
    {paymentStatus:'PENDING'},{paymentMethod:'COD',paymentStatus:'REFUNDED'},{checkoutTaxSnapshot:{version:2}},{items:[...source.items,source.items[0]]},
    {items:[{...source.items[0],productId:'other'},...source.items.slice(1)]}]) assert.throws(()=>reconcileWebsiteOrder({...source,...data}));
  assert.throws(()=>calculateInvoiceAmounts({...snapshot,points:100000}));
});
test('legacy orders must have unchanged original product data, consistent GST and an exact historical total',()=>{
  const l=item('a',10500,5);
  const historical={...order(),items:[{...l,product:{gstRate:5,hsnCode:'A',updatedAt:new Date('2026-01-01')}}],checkoutTaxSnapshot:null,
    subtotal:10500,total:10500,tax:500,shipping:0,discount:0,pointsValue:0,giftWrap:false};
  assert.equal(reconcileWebsiteOrder(historical).products[0].taxable,10000);
  for(const override of [{source:'UNKNOWN'},{total:11000},{tax:501},{giftWrap:true},
    {items:[{...historical.items[0], product:{...historical.items[0].product,updatedAt:new Date('2026-03-01')}}]}]) {
    assert.throws(()=>reconcileWebsiteOrder({...historical,...override}));
  }
});
test('fee classification honours an explicit rate including zero; mixed-rate fees never silently inherit a random item',()=>{
  const key='NEEJEE_SHIPPING_GST_RATE',backup=process.env[key];
  try {
    delete process.env[key];assert.equal(checkoutFee(100,[inputs[0]],'SHIPPING').gstRate,5);
    assert.equal(checkoutFee(0,inputs,'SHIPPING').amount,0);
    assert.throws(()=>checkoutFee(100,inputs,'SHIPPING'),/Mixed-rate/);
    process.env[key]='0';assert.equal(checkoutFee(100,inputs,'SHIPPING').gstRate,0);
    process.env[key]='18';assert.equal(checkoutFee(100,inputs,'SHIPPING').gstRate,18);
    assert.throws(()=>checkoutFee(100,inputs,'SHIPPING',true),/Mixed-rate/);
    process.env[key]='oops';assert.throws(()=>checkoutFee(100,inputs,'SHIPPING'),/configured/);
  } finally {if(backup===undefined) delete process.env[key];else process.env[key]=backup;}
});
