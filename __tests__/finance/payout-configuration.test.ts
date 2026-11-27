import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayout, razorpayxConfigured } from '../../lib/razorpayx';

test('payouts require a complete matching pair, callback and persisted idempotency key', async t => {
  const names = ['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAYX_KEY_ID','RAZORPAYX_KEY_SECRET','RAZORPAYX_SOURCE_ACCOUNT_NUMBER','RAZORPAYX_ACCOUNT_NUMBER','RAZORPAYX_WEBHOOK_SECRET','VERCEL_ENV'];
  const previous = names.map(k => process.env[k]);
  t.after(() => names.forEach((k,i) => { if (previous[i] === undefined) delete process.env[k]; else process.env[k] = previous[i]; }));
  names.forEach(k => delete process.env[k]);
  Object.assign(process.env, { RAZORPAY_KEY_ID:'rzp_live_shop', RAZORPAY_KEY_SECRET:'checkout-only', RAZORPAYX_SOURCE_ACCOUNT_NUMBER:'fixture', VERCEL_ENV:'preview' });
  assert.equal(razorpayxConfigured(),false);
  Object.assign(process.env,{ RAZORPAYX_KEY_ID:'rzp_test_payout', RAZORPAYX_KEY_SECRET:'sandbox' });
  assert.equal(razorpayxConfigured(),false);
  process.env.RAZORPAYX_WEBHOOK_SECRET = 'synthetic-webhook';
  assert.equal(razorpayxConfigured(),true);
  process.env.VERCEL_ENV = 'production';
  assert.equal(razorpayxConfigured(),false);
  process.env.VERCEL_ENV = 'preview';
  const send = t.mock.method(globalThis,'fetch',async (_url: unknown, init: RequestInit) => {
    const headers = new Headers(init.headers);
    assert.equal(headers.get('X-Payout-Idempotency'),'fixture-reference');
    assert.equal(headers.get('authorization'),'Basic ' + Buffer.from('rzp_test_payout:sandbox').toString('base64'));
    assert.equal(JSON.parse(String(init.body)).account_number,'fixture');
    return Response.json({id:'mock-payout',status:'processing'});
  });
  const input = {reference_id:'',fund_account_id:'mock-fund',amount:100,mode:'IMPS',purpose:'vendor_bill'} as const;
  assert.equal((await createPayout(input)).ok,false);
  assert.equal(send.mock.callCount(),0);
  assert.equal((await createPayout({...input,reference_id:'fixture-reference'})).ok,true);
  assert.equal(send.mock.callCount(),1);
});
