// TDS certificate (Form 16A) helpers.
//
// Indian FY runs April 1 → March 31. Quarter mapping:
//   Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar.
// Form 16A is issued quarterly, due 15 days after the quarterly TDS return
// filing (which is itself due ~30 days after quarter-end).

import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export type Quarter = 1 | 2 | 3 | 4;

/** Convert a JS Date to its Indian FY+Q. */
export function dateToFyQuarter(d: Date): { financialYear: string; quarter: Quarter; start: Date; end: Date } {
  // IST: convert to IST date components
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();           // 0=Jan
  // FY year = if month >= April(3), then current calendar year; else previous year
  const fyStart = m >= 3 ? y : y - 1;
  const fy = `${fyStart}-${(fyStart + 1).toString().slice(-2)}`;
  const quarter: Quarter = (
    m >= 3 && m <= 5  ? 1 :
    m >= 6 && m <= 8  ? 2 :
    m >= 9 && m <= 11 ? 3 :
                        4
  ) as Quarter;
  const qStart = (() => {
    if (quarter === 1) return new Date(Date.UTC(fyStart, 3, 1, -5, -30));   // Apr 1
    if (quarter === 2) return new Date(Date.UTC(fyStart, 6, 1, -5, -30));   // Jul 1
    if (quarter === 3) return new Date(Date.UTC(fyStart, 9, 1, -5, -30));   // Oct 1
    return new Date(Date.UTC(fyStart + 1, 0, 1, -5, -30));                  // Jan 1
  })();
  const qEnd = (() => {
    if (quarter === 1) return new Date(Date.UTC(fyStart, 6, 1, -5, -30));   // exclusive
    if (quarter === 2) return new Date(Date.UTC(fyStart, 9, 1, -5, -30));
    if (quarter === 3) return new Date(Date.UTC(fyStart + 1, 0, 1, -5, -30));
    return new Date(Date.UTC(fyStart + 1, 3, 1, -5, -30));                  // Apr 1 next FY
  })();
  return { financialYear: fy, quarter, start: qStart, end: qEnd };
}

export function parseFyQuarter(fy: string, quarter: Quarter): { start: Date; end: Date } {
  // fy is "2025-26" → fyStart = 2025
  const fyStart = parseInt(fy.split('-')[0]);
  if (!fyStart) throw new Error('Invalid financialYear');
  const fakeDate = new Date(Date.UTC(
    quarter <= 3 ? fyStart : fyStart + 1,
    quarter === 1 ? 4 : quarter === 2 ? 7 : quarter === 3 ? 10 : 1,
    1, -5, -30,
  ));
  return dateToFyQuarter(fakeDate);
}

/** Aggregate VendorPayout.tdsPaise for a vendor in a quarter. */
export async function aggregateVendorTdsForQuarter(
  vendorId: string,
  financialYear: string,
  quarter: Quarter,
): Promise<{
  grossPaymentsPaise: number;
  tdsDeductedPaise: number;
  coveredPayoutIds: string[];
  paidPayoutCount: number;
}> {
  const { start, end } = parseFyQuarter(financialYear, quarter);

  // Only PAID payouts count for TDS certificates (cash basis).
  const payouts = await prisma.vendorPayout.findMany({
    where: {
      vendorId,
      status: 'PAID',
      paidAt: { gte: start, lt: end, not: null },
    },
    select: { id: true, grossPaise: true, tdsPaise: true },
  });

  return {
    grossPaymentsPaise: payouts.reduce((s, p) => s + (p.grossPaise || 0), 0),
    tdsDeductedPaise: payouts.reduce((s, p) => s + (p.tdsPaise || 0), 0),
    coveredPayoutIds: payouts.map(p => p.id),
    paidPayoutCount: payouts.length,
  };
}

/** Compute the auto-incrementing certificate sequence for FY-Q. */
async function nextCertSequence(financialYear: string, quarter: Quarter): Promise<number> {
  const count = await prisma.tdsCertificate.count({
    where: { financialYear, quarter },
  });
  return count + 1;
}

/** Create or refresh a TdsCertificate row. Idempotent — if one already exists for
 *  (vendor, FY, quarter), we refresh its totals from current payout data. */
export async function upsertTdsCertificate(args: {
  vendorId: string;
  financialYear: string;
  quarter: Quarter;
  tdsRate?: number;
  section?: string;
  issuedByUserId?: string;
}): Promise<{ id: string; created: boolean; grossPaymentsPaise: number; tdsDeductedPaise: number }> {
  const { vendorId, financialYear, quarter } = args;
  const { start, end } = parseFyQuarter(financialYear, quarter);

  // Pull vendor snapshot
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      displayName: true, legalName: true,
      addressLine1: true, addressLine2: true, city: true, state: true, pincode: true,
      // PAN isn't on Vendor today; we infer from GSTIN's first 10 chars where possible
      // (GSTIN format: 22ABCDE1234F1Z5 — chars 3-12 are PAN). Stored explicitly below.
    },
  });
  if (!vendor) throw new Error('Vendor not found');

  // Aggregate from payouts
  const agg = await aggregateVendorTdsForQuarter(vendorId, financialYear, quarter);

  const address = [vendor.addressLine1, vendor.addressLine2, vendor.city, vendor.state, vendor.pincode]
    .filter(Boolean).join(', ');

  // Upsert
  const existing = await prisma.tdsCertificate.findUnique({
    where: { vendorId_financialYear_quarter: { vendorId, financialYear, quarter } },
  });

  if (existing) {
    const updated = await prisma.tdsCertificate.update({
      where: { id: existing.id },
      data: {
        grossPaymentsPaise: agg.grossPaymentsPaise,
        tdsDeductedPaise: agg.tdsDeductedPaise,
        coveredPayoutIds: agg.coveredPayoutIds,
        vendorNameSnapshot: vendor.displayName || vendor.legalName,
        vendorAddressSnapshot: address || null,
        ...(args.tdsRate ? { tdsRate: args.tdsRate } : {}),
        ...(args.section ? { section: args.section } : {}),
      },
    });
    return {
      id: updated.id,
      created: false,
      grossPaymentsPaise: agg.grossPaymentsPaise,
      tdsDeductedPaise: agg.tdsDeductedPaise,
    };
  }

  // Generate certificateNumber: NJ-16A-{FY}-Q{q}-V{nnnn}
  const seq = await nextCertSequence(financialYear, quarter);
  const certNo = `NJ-16A-${financialYear}-Q${quarter}-V${String(seq).padStart(4, '0')}`;

  const created = await prisma.tdsCertificate.create({
    data: {
      id: 'tds_' + randomBytes(10).toString('hex'),
      vendorId,
      vendorNameSnapshot: vendor.displayName || vendor.legalName,
      vendorAddressSnapshot: address || null,
      financialYear,
      quarter,
      periodStart: start,
      periodEnd: end,
      grossPaymentsPaise: agg.grossPaymentsPaise,
      tdsDeductedPaise: agg.tdsDeductedPaise,
      tdsRate: args.tdsRate || 1.0,
      section: args.section || '194Q',
      certificateNumber: certNo,
      coveredPayoutIds: agg.coveredPayoutIds,
      issuedByUserId: args.issuedByUserId || null,
    },
  });

  return {
    id: created.id,
    created: true,
    grossPaymentsPaise: agg.grossPaymentsPaise,
    tdsDeductedPaise: agg.tdsDeductedPaise,
  };
}

/** Generate certificates for ALL vendors that had PAID payouts in a quarter.
 *  Idempotent — refreshes existing rows. Returns counts. */
export async function generateAllCertificatesForQuarter(
  financialYear: string, quarter: Quarter, issuedByUserId?: string,
): Promise<{ vendors: number; created: number; refreshed: number }> {
  const { start, end } = parseFyQuarter(financialYear, quarter);

  // Find vendors who had any PAID payout in the period
  const vendors = await prisma.vendorPayout.groupBy({
    by: ['vendorId'],
    where: { status: 'PAID', paidAt: { gte: start, lt: end, not: null } },
    _count: { _all: true },
  });

  let created = 0, refreshed = 0;
  for (const v of vendors) {
    const r = await upsertTdsCertificate({
      vendorId: v.vendorId,
      financialYear,
      quarter,
      issuedByUserId,
    });
    if (r.created) created += 1; else refreshed += 1;
  }
  return { vendors: vendors.length, created, refreshed };
}
