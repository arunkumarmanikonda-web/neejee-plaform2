import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ERP_DASHBOARD_VERSION,
  buildAttemptDailySeries,
  buildDateSeries,
  normalizeRangeDays,
  startOfUtcDay,
} from '../../lib/erp/dashboard';

describe('ERP dashboard helpers', () => {
  it('exposes a stable version', () => {
    assert.equal(ERP_DASHBOARD_VERSION, 'erp.dashboard.v1');
  });

  it('normalizes allowed ranges safely', () => {
    assert.equal(normalizeRangeDays('7'), 7);
    assert.equal(normalizeRangeDays('30'), 30);
    assert.equal(normalizeRangeDays('90'), 90);
    assert.equal(normalizeRangeDays('999'), 30);
    assert.equal(normalizeRangeDays(null), 30);
  });

  it('rounds to the start of the UTC day', () => {
    const value = startOfUtcDay(new Date('2026-07-10T18:45:33.000Z'));
    assert.equal(value.toISOString(), '2026-07-10T00:00:00.000Z');
  });

  it('builds a deterministic date series', () => {
    const dates = buildDateSeries(3, new Date('2026-07-10T12:00:00.000Z'));
    assert.deepEqual(dates, ['2026-07-08', '2026-07-09', '2026-07-10']);
  });

  it('builds daily attempt counts by status', () => {
    const series = buildAttemptDailySeries(
      [
        { createdAt: '2026-07-08T01:00:00.000Z', status: 'QUEUED' },
        { createdAt: '2026-07-08T04:00:00.000Z', status: 'FAILED' },
        { createdAt: '2026-07-09T07:00:00.000Z', status: 'SUCCEEDED' },
        { createdAt: '2026-07-10T11:00:00.000Z', status: 'DEAD_LETTER' },
        { createdAt: '2026-07-10T15:30:00.000Z', status: 'PROCESSING' },
      ],
      3,
      new Date('2026-07-10T12:00:00.000Z')
    );

    assert.deepEqual(series, [
      {
        date: '2026-07-08',
        total: 2,
        queued: 1,
        processing: 0,
        succeeded: 0,
        failed: 1,
        deadLetter: 0,
      },
      {
        date: '2026-07-09',
        total: 1,
        queued: 0,
        processing: 0,
        succeeded: 1,
        failed: 0,
        deadLetter: 0,
      },
      {
        date: '2026-07-10',
        total: 2,
        queued: 0,
        processing: 1,
        succeeded: 0,
        failed: 0,
        deadLetter: 1,
      },
    ]);
  });
});
