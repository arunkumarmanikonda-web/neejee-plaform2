import type {
  ErpAttemptDailyPoint,
  ErpDashboardRangeDays,
} from './contracts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type AttemptLike = {
  createdAt: Date | string;
  status: string;
};

type GroupCountRow = {
  [key: string]: any;
  _count: {
    _all: number;
  };
};

export function normalizeRangeDays(rawValue: string | null | undefined): ErpDashboardRangeDays {
  if (rawValue === '7') return 7;
  if (rawValue === '90') return 90;
  return 30;
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function buildDateSeries(
  days: ErpDashboardRangeDays | number,
  now: Date = new Date()
): string[] {
  const safeDays = Math.max(1, Math.floor(days));
  const end = startOfUtcDay(now);
  const startTime = end.getTime() - (safeDays - 1) * ONE_DAY_MS;

  return Array.from({ length: safeDays }, (_, index) => {
    return new Date(startTime + index * ONE_DAY_MS).toISOString().slice(0, 10);
  });
}

export function buildAttemptDailySeries(
  rows: AttemptLike[],
  days: ErpDashboardRangeDays | number,
  now: Date = new Date()
): ErpAttemptDailyPoint[] {
  const dates = buildDateSeries(days, now);

  const buckets = new Map<string, ErpAttemptDailyPoint>(
    dates.map((date) => [
      date,
      {
        date,
        total: 0,
        queued: 0,
        processing: 0,
        succeeded: 0,
        failed: 0,
        deadLetter: 0,
      },
    ])
  );

  for (const row of rows) {
    const createdAt =
      row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);

    const dateKey = createdAt.toISOString().slice(0, 10);
    const bucket = buckets.get(dateKey);

    if (!bucket) continue;

    bucket.total += 1;

    switch (row.status) {
      case 'QUEUED':
        bucket.queued += 1;
        break;
      case 'PROCESSING':
        bucket.processing += 1;
        break;
      case 'SUCCEEDED':
        bucket.succeeded += 1;
        break;
      case 'FAILED':
        bucket.failed += 1;
        break;
      case 'DEAD_LETTER':
        bucket.deadLetter += 1;
        break;
      default:
        break;
    }
  }

  return dates.map((date) => buckets.get(date)!);
}

export function toCountMap(
  rows: GroupCountRow[],
  field: string
): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row[field]);
    acc[key] = row._count?._all ?? 0;
    return acc;
  }, {});
}
