// v23.40.13 — Sequential, gapless, FY-continuous invoice numbering.
//
// Pattern: <PREFIX>/<FY>/<NNNNN>  e.g.  INV/25-26/00001
// Counter is per (prefix, fiscalYear). Indian FY runs Apr → Mar, so any
// invoice dated 1-Apr-2025 through 31-Mar-2026 falls in FY 25-26.
//
// Why this change: month-resetting numbers (e.g. INV/2606/0001) break audit
// continuity — auditors and GST officers expect one continuous, gapless series
// per FY per prefix. Reset only happens on 1-Apr.

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

/** Returns the Indian fiscal-year tag for a date, e.g. "25-26" for 1-Apr-2025 → 31-Mar-2026. */
export function fiscalYearOf(date: Date): string {
  const m = date.getMonth() + 1; // 1..12
  const y = date.getFullYear();
  // Apr (4) onwards = start of FY; Jan-Mar belong to previous FY-start
  const startYear = m >= 4 ? y : y - 1;
  const endYear   = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

export async function nextInvoiceNumber(prefix: 'INV' | 'COM' | 'POS' | 'BLK', date: Date = new Date()): Promise<string> {
  const fy = fiscalYearOf(date);

  // We re-use the existing yearMonth column to store the FY tag for backward
  // compatibility (the migration in this version doesn't change the schema —
  // we just store '25-26' instead of '2506').
  const counter = await prisma.invoiceNumberCounter.upsert({
    where: { prefix_yearMonth: { prefix, yearMonth: fy } },
    update: { lastValue: { increment: 1 } },
    create: {
      id: 'ctr_' + randomBytes(8).toString('hex'),
      prefix, yearMonth: fy, lastValue: 1,
    },
  });
  return `${prefix}/${fy}/${String(counter.lastValue).padStart(5, '0')}`;
}

export function monthBucketOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
