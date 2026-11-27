import test from 'node:test';
import assert from 'node:assert/strict';
import { razorpayCredentials, liveCheckoutUnavailable } from '../../lib/payments/razorpay-credentials';

test('checkout can use its published live merchant ID and still requires the private secret', () => {
  const names = ['RAZORPAY_KEY_ID', 'NEXT_PUBLIC_RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'VERCEL_ENV'];
  const original = new Map(names.map(name => [name, process.env[name]]));
  try {
    process.env.VERCEL_ENV = 'production';
    process.env.RAZORPAY_KEY_ID = '  ';
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_live_example';
    process.env.RAZORPAY_KEY_SECRET = '  ';
    assert.deepEqual(razorpayCredentials(), {keyId: 'rzp_live_example', keySecret: ''});
    process.env.RAZORPAY_KEY_SECRET = 'fixture-secret';
    assert.deepEqual(razorpayCredentials(), {keyId: 'rzp_live_example', keySecret: 'fixture-secret'});
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_test_example';
    assert.equal(razorpayCredentials().keyId, '');
    process.env.RAZORPAY_KEY_ID = 'rzp_live_preferred';
    assert.equal(razorpayCredentials().keyId, 'rzp_live_preferred');
    assert.equal(liveCheckoutUnavailable(), false);
    process.env.RAZORPAY_KEY_ID = 'rzp_test_preferred';
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = 'rzp_live_example';
    assert.equal(liveCheckoutUnavailable(), true);
    assert.equal(liveCheckoutUnavailable(''), true);
    process.env.VERCEL_ENV = 'preview';
    assert.equal(liveCheckoutUnavailable(), false);
  } finally {
    for (const [name, value] of original) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
