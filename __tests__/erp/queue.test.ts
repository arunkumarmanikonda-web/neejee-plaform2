import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ERP_QUEUE_VERSION,
  computeBackoffDelayMs,
  planNextRetry,
  shouldMoveToDeadLetter,
} from '../../lib/erp/queue';

describe('ERP queue helpers', () => {
  it('exposes a stable version', () => {
    assert.equal(ERP_QUEUE_VERSION, 'erp.queue.v1');
  });

  it('computes exponential backoff with default settings', () => {
    assert.equal(computeBackoffDelayMs(1), 30_000);
    assert.equal(computeBackoffDelayMs(2), 60_000);
    assert.equal(computeBackoffDelayMs(3), 120_000);
  });

  it('respects a configured max delay cap', () => {
    assert.equal(
      computeBackoffDelayMs(10, {
        baseDelayMs: 30_000,
        factor: 2,
        maxDelayMs: 120_000,
      }),
      120_000
    );
  });

  it('does not dead-letter before max attempts are exhausted', () => {
    assert.equal(
      shouldMoveToDeadLetter({
        attemptNumber: 2,
        maxAttempts: 5,
      }),
      false
    );
  });

  it('moves to dead-letter when attempts are exhausted', () => {
    assert.equal(
      shouldMoveToDeadLetter({
        attemptNumber: 5,
        maxAttempts: 5,
      }),
      true
    );
  });

  it('plans the next retry deterministically', () => {
    const plan = planNextRetry(
      {
        attemptNumber: 2,
        maxAttempts: 5,
      },
      new Date('2026-07-10T00:00:00.000Z')
    );

    assert.deepEqual(plan, {
      nextAttemptNumber: 3,
      delayMs: 60_000,
      runAfter: '2026-07-10T00:01:00.000Z',
      shouldDeadLetter: false,
    });
  });

  it('returns a dead-letter plan when max attempts have already been reached', () => {
    const plan = planNextRetry(
      {
        attemptNumber: 5,
        maxAttempts: 5,
      },
      new Date('2026-07-10T00:00:00.000Z')
    );

    assert.deepEqual(plan, {
      nextAttemptNumber: 6,
      delayMs: 0,
      runAfter: '2026-07-10T00:00:00.000Z',
      shouldDeadLetter: true,
    });
  });
});
