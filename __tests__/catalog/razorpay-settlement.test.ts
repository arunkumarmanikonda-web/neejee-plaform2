import test from 'node:test';
import assert from 'node:assert/strict';
import { captureState, fetchGatewayPayment, fetchRefundedPaise, processedRefundTotal } from '../../lib/payments/razorpay-settlement';

const paid = {id:'pay_sample', order_id:'order_sample', amount:680000, currency:'INR',status:'captured',captured:true,amount_refunded:0};
const check = (value:Parameters<typeof captureState>[0]) => captureState(value,'pay_sample','order_sample',680000);
test('only captured INR for the exact order, payment ID, and amount is eligible', () => {
  assert.equal(check(paid),'captured');
  for (const changed of [{currency:'USD'},{order_id:'order_other'},{id:'pay_other'},{amount:1}]) assert.equal(check({...paid,...changed}),'mismatch');
  assert.equal(check({...paid,captured:false,status:'authorized'}),'pending');
  assert.equal(check({...paid,captured:false}),'pending');
  assert.equal(check({...paid,status:'refunded'}),'refunded');
  assert.equal(check({...paid,amount_refunded:100}),'refunded');
  assert.equal(check({...paid,status:'failed'}),'failed');
});
const partial = {id:'rf_1',payment_id:'pay_sample',currency:'INR',status:'processed',amount:200000};
test('several processed partials sum to full; repeats and unprocessed refunds do not count', () => {
  const rows = [partial,partial,{...partial,id:'rf_2',amount:480000},{...partial,status:'pending',id:'rf_3'},
    {...partial,status:'failed',id:'rf_4'},{...partial,payment_id:'other',id:'rf_5'}];
  assert.equal(processedRefundTotal(rows,'pay_sample'),680000);
  assert.throws(() => processedRefundTotal([partial,{...partial,amount:1}],'pay_sample'));
  assert.throws(() => processedRefundTotal([{...partial,currency:'USD'}],'pay_sample'));
});
test('gateway reads are authenticated, reject unavailable providers and paginate processed refunds', async context => {
  const oldKey=process.env.RAZORPAY_KEY_ID, oldSecret=process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID='mock'; process.env.RAZORPAY_KEY_SECRET='mock';
  try {
    const paths:string[]=[];
    let fail=false;
    context.mock.method(globalThis,'fetch',async (url:string,init:RequestInit) => {
      assert.ok((init.headers as Record<string,string>).Authorization.startsWith('Basic '));paths.push(url);
      if (fail) return new Response('{}',{status:503});
      if (!url.includes('/refunds')) return Response.json(paid);
      const items = url.includes('skip=100') ? [partial] : Array.from({length:100},(_,i)=>({...partial,id:'pending_'+i,status:'pending'}));
      return Response.json({items});
    });
    assert.equal(check(await fetchGatewayPayment('pay_sample')),'captured');
    assert.equal(await fetchRefundedPaise('pay_sample',partial),200000);
    assert.equal(paths.length,3);assert.match(paths[2],/skip=100$/);
    fail=true;await assert.rejects(fetchGatewayPayment('pay_sample'));
  } finally {
    if (oldKey===undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID=oldKey;
    if (oldSecret===undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET=oldSecret;
  }
});
