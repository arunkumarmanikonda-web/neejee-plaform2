// Date period helpers for finance reporting.
// All dates are interpreted in IST (UTC+5:30) since NEEJEE operates in India.

export type Period = {
  from: Date;     // inclusive (00:00 IST)
  to: Date;       // exclusive (next day 00:00 IST)
  label: string;
};

const IST_OFFSET_MIN = 5 * 60 + 30;   // +330 min

/** Convert a JS Date to IST-midnight start-of-day. */
export function istStartOfDay(d: Date): Date {
  // Trick: shift to IST, floor to date, shift back.
  const utc = d.getTime() + d.getTimezoneOffset() * 60_000;
  const ist = new Date(utc + IST_OFFSET_MIN * 60_000);
  ist.setHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MIN * 60_000 - new Date().getTimezoneOffset() * 60_000);
}

/** Parse a YYYY-MM-DD string as IST-midnight. */
export function parseIstDate(s: string): Date {
  // Treat as IST midnight => UTC = IST midnight - 5:30
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${s}`);
  return new Date(Date.UTC(y, m - 1, d, -5, -30, 0, 0));
}

/** Format a Date in IST as YYYY-MM-DD. */
export function formatIstDate(d: Date): string {
  const utcMs = d.getTime();
  const ist = new Date(utcMs + IST_OFFSET_MIN * 60_000);
  return ist.toISOString().slice(0, 10);
}

/** Convenience builders. */
export function periodToday(): Period {
  const now = new Date();
  const from = parseIstDate(formatIstDate(now));
  const to = new Date(from.getTime() + 24 * 3600 * 1000);
  return { from, to, label: 'Today' };
}

export function periodThisWeek(): Period {
  const now = new Date();
  // ISO week starts Monday
  const day = (now.getUTCDay() + 6) % 7;
  const from = parseIstDate(formatIstDate(new Date(now.getTime() - day * 86400_000)));
  const to = new Date(from.getTime() + 7 * 86400_000);
  return { from, to, label: 'This week' };
}

export function periodLastWeek(): Period {
  const tw = periodThisWeek();
  return {
    from: new Date(tw.from.getTime() - 7 * 86400_000),
    to: tw.from,
    label: 'Last week',
  };
}

export function periodThisMonth(): Period {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1, -5, -30));
  const to = new Date(Date.UTC(y, m + 1, 1, -5, -30));
  return { from, to, label: 'This month' };
}

export function periodLastMonth(): Period {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60_000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const from = new Date(Date.UTC(y, m - 1, 1, -5, -30));
  const to = new Date(Date.UTC(y, m, 1, -5, -30));
  return { from, to, label: 'Last month' };
}

export function periodFromRange(fromStr: string, toStr: string): Period {
  const from = parseIstDate(fromStr);
  const toIncl = parseIstDate(toStr);
  const to = new Date(toIncl.getTime() + 24 * 3600 * 1000); // make exclusive
  return { from, to, label: `${fromStr} → ${toStr}` };
}

/** Resolve a preset name into a period. */
export function resolvePeriod(preset?: string, from?: string, to?: string): Period {
  if (from && to) return periodFromRange(from, to);
  switch (preset) {
    case 'today':       return periodToday();
    case 'this_week':   return periodThisWeek();
    case 'last_week':   return periodLastWeek();
    case 'this_month':  return periodThisMonth();
    case 'last_month':  return periodLastMonth();
    default:            return periodThisMonth();
  }
}
