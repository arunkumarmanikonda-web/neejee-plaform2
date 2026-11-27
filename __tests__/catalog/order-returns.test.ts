import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadReturnOrder, issueReturnAccess, RETURN_ACCESS_SECONDS } from '../../lib/returns/guest-access';
import { availableReasons, readReturnRequest, returnCaseId } from '../../lib/returns/request';

test('guest proof binds one guest order and expires at the deadline', () => {
  const before = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'fixture-only-order-return-secret-long-enough';
  try {
    const now = 1_800_000_000_000;
    const order = { id: 'order-a', userId: null };
    const token = issueReturnAccess(order.id, now);
    assert.equal(canReadReturnOrder(order, undefined, token, now), true);
    assert.equal(canReadReturnOrder({ ...order, id: 'order-b' }, undefined, token, now), false);
    assert.equal(canReadReturnOrder(order, undefined, token, now + RETURN_ACCESS_SECONDS * 1000), false);
    assert.equal(canReadReturnOrder(order, undefined, token.slice(0, -2) + 'xx', now), false);
    assert.equal(canReadReturnOrder(order, 'signed-in-user', undefined, now), false);
    assert.equal(canReadReturnOrder({ id: 'order-a', userId: 'customer' }, 'other', token, now), false);
    assert.equal(canReadReturnOrder({ id: 'order-a', userId: 'customer' }, 'customer', undefined, now), true);
  } finally {
    if (before === undefined) delete process.env.AUTH_SECRET; else process.env.AUTH_SECRET = before;
  }
});

test('ordinary returns follow piece eligibility and delivery exceptions remain available', () => {
  assert.deepEqual(availableReasons('DELIVERED', true), ['RETURN', 'DAMAGED', 'WRONG_ITEM']);
  assert.deepEqual(availableReasons('DELIVERED', false), ['DAMAGED', 'WRONG_ITEM']);
  for (const state of ['PLACED', 'SHIPPED', 'CANCELLED', 'REFUNDED', 'RETURNED']) {
    assert.deepEqual(availableReasons(state, true), []);
  }
});

test('return requests require a line, bounded integer quantity and a known reason', () => {
  const sample = { itemId: 'purchased-line', quantity: 1, reason: 'DAMAGED', note: ' Loose bead ' };
  assert.equal(readReturnRequest(sample)?.note, 'Loose bead');
  for (const change of [{ quantity: 0 }, { quantity: 1.5 }, { quantity: '1' }, { reason: 'toString' }, { reason: 'approve' }, { itemId: '' }, { note: 1 }, { note: 'x'.repeat(2001) }]) {
    assert.equal(readReturnRequest({ ...sample, ...change }), null);
  }
  assert.equal(returnCaseId(sample.itemId), 'return-purchased-line');
});
