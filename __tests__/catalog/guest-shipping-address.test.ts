import test from 'node:test';
import assert from 'node:assert/strict';
import { orderShippingAddress } from '../../lib/checkout/order-shipping-address';

const address = { name: ' Test Recipient ', line1: ' 12 Example Lane ', city: 'Jaipur', state: 'Rajasthan', pincode: '302001', line2: '   ' };
test('guest delivery is attached to the order without claiming an account', () => {
  assert.deepEqual(orderShippingAddress(undefined, address, '98765 43210'), {
    userId: null, name: 'Test Recipient', phone: '98765 43210', line1: '12 Example Lane', line2: null,
    city: 'Jaipur', state: 'Rajasthan', pincode: '302001', country: 'IN',
  });
});
test('the account owner comes only from the verified session', () => {
  const submitted = {...address, userId:'another-user', id:'other-address', country:'US'};
  assert.equal(orderShippingAddress('signed-in-user', submitted, '+91 98765 43210').userId, 'signed-in-user');
  assert.equal(orderShippingAddress(undefined, submitted, '9876543210').userId, null);
  assert.equal(orderShippingAddress(undefined, submitted, '9876543210').country, 'IN');
});
test('incomplete destination, pin or mobile cannot become an unshippable order', () => {
  for (const [field, value] of [['city', ' '], ['state', null], ['line1', {}], ['pincode', '1100']]) {
    assert.throws(() => orderShippingAddress(undefined, {...address, [field as string]:value}, '9876543210'));
  }
  for (const phone of ['a9876543210', '123456', '12345678901234567890']) assert.throws(() => orderShippingAddress(undefined,address,phone));
});
