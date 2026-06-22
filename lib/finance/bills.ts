// Bills (accounts payable) helpers.
import { prisma } from '@/lib/prisma';

/** Re-derive the bill's status based on paidPaise vs totalPaise and dueOn vs today. */
export function deriveBillStatus(bill: {
  totalPaise: number;
  paidPaise: number;
  dueOn: Date | string;
  status: string;
}): 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'OPEN' | 'DRAFT' | 'CANCELLED' {
  if (bill.status === 'CANCELLED' || bill.status === 'DRAFT') return bill.status as any;
  if (bill.paidPaise >= bill.totalPaise) return 'PAID';
  const due = typeof bill.dueOn === 'string' ? new Date(bill.dueOn) : bill.dueOn;
  const isOverdue = due.getTime() < Date.now() - 86_400_000;  // > 1 day past due
  if (bill.paidPaise > 0) {
    // Partially paid — overdue takes precedence visually
    return isOverdue ? 'OVERDUE' : 'PARTIALLY_PAID';
  }
  return isOverdue ? 'OVERDUE' : 'OPEN';
}

/** Recompute a bill's paidPaise and status from its payments. */
export async function recomputeBillStatus(billId: string): Promise<void> {
  const bill = await prisma.bill.findUnique({ where: { id: billId } });
  if (!bill) return;
  const agg = await prisma.billPayment.aggregate({
    where: { billId },
    _sum: { amountPaise: true },
  });
  const paidPaise = agg._sum.amountPaise || 0;
  const newStatus = deriveBillStatus({ ...bill, paidPaise });
  if (paidPaise !== bill.paidPaise || newStatus !== bill.status) {
    await prisma.bill.update({
      where: { id: billId },
      data: { paidPaise, status: newStatus as any },
    });
  }
}

/** Aging buckets — used for AP report. Inputs in PAISE. */
export type AgingBucket = {
  bucket: 'CURRENT' | '1_30' | '31_60' | '61_90' | '90_PLUS';
  label: string;
  count: number;
  outstandingPaise: number;
};

export function bucketBy(daysOverdue: number): AgingBucket['bucket'] {
  if (daysOverdue <= 0)  return 'CURRENT';
  if (daysOverdue <= 30) return '1_30';
  if (daysOverdue <= 60) return '31_60';
  if (daysOverdue <= 90) return '61_90';
  return '90_PLUS';
}

const LABELS: Record<AgingBucket['bucket'], string> = {
  CURRENT: 'Not yet due',
  '1_30':  '1–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  '90_PLUS': '90+ days',
};

/** AP aging — what we owe vendors, bucketed. */
export async function computeApAging(): Promise<{
  buckets: AgingBucket[];
  totalOutstandingPaise: number;
  byVendor: { vendorId: string | null; vendorName: string; outstandingPaise: number; billCount: number }[];
}> {
  const open = await prisma.bill.findMany({
    where: { status: { in: ['OPEN', 'OVERDUE', 'PARTIALLY_PAID'] } },
    select: {
      id: true, vendorId: true, vendorNameSnapshot: true,
      totalPaise: true, paidPaise: true, dueOn: true,
    },
  });

  const buckets: Record<AgingBucket['bucket'], { count: number; outstandingPaise: number }> = {
    CURRENT: { count: 0, outstandingPaise: 0 },
    '1_30':  { count: 0, outstandingPaise: 0 },
    '31_60': { count: 0, outstandingPaise: 0 },
    '61_90': { count: 0, outstandingPaise: 0 },
    '90_PLUS': { count: 0, outstandingPaise: 0 },
  };
  const byVendor = new Map<string, { vendorId: string | null; vendorName: string; outstandingPaise: number; billCount: number }>();

  let total = 0;
  const now = Date.now();
  for (const b of open) {
    const outstanding = b.totalPaise - b.paidPaise;
    if (outstanding <= 0) continue;
    const daysOverdue = Math.floor((now - new Date(b.dueOn).getTime()) / 86_400_000);
    const bucket = bucketBy(daysOverdue);
    buckets[bucket].count += 1;
    buckets[bucket].outstandingPaise += outstanding;
    total += outstanding;

    const key = b.vendorId || `external:${b.vendorNameSnapshot || 'Unknown'}`;
    const existing = byVendor.get(key) || {
      vendorId: b.vendorId,
      vendorName: b.vendorNameSnapshot || (b.vendorId ? '' : 'Unknown'),
      outstandingPaise: 0,
      billCount: 0,
    };
    existing.outstandingPaise += outstanding;
    existing.billCount += 1;
    byVendor.set(key, existing);
  }

  // Hydrate vendor names (for ones with vendorId but no snapshot)
  const vendorIds = Array.from(byVendor.values())
    .filter(v => v.vendorId && !v.vendorName)
    .map(v => v.vendorId!) as string[];
  if (vendorIds.length > 0) {
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
      select: { id: true, legalName: true, displayName: true },
    });
    const vMap = new Map(vendors.map(v => [v.id, v.displayName || v.legalName]));
    for (const v of byVendor.values()) {
      if (v.vendorId && !v.vendorName) v.vendorName = vMap.get(v.vendorId) || 'Vendor';
    }
  }

  return {
    buckets: (['CURRENT', '1_30', '31_60', '61_90', '90_PLUS'] as const).map(b => ({
      bucket: b,
      label: LABELS[b],
      count: buckets[b].count,
      outstandingPaise: buckets[b].outstandingPaise,
    })),
    totalOutstandingPaise: total,
    byVendor: Array.from(byVendor.values()).sort((a, b) => b.outstandingPaise - a.outstandingPaise),
  };
}

/** AR aging — what customers owe us. Mostly N/A for prepaid e-commerce,
 *  but useful when COD / B2B invoicing is active. Inputs: order.paymentStatus = PENDING & status != CANCELLED. */
export async function computeArAging(): Promise<{
  buckets: AgingBucket[];
  totalOutstandingPaise: number;
}> {
  const unpaid = await prisma.order.findMany({
    where: {
      paymentStatus: 'PENDING',
      status: { notIn: ['CANCELLED'] },
    },
    select: { id: true, total: true, createdAt: true },
  });
  const buckets: Record<AgingBucket['bucket'], { count: number; outstandingPaise: number }> = {
    CURRENT: { count: 0, outstandingPaise: 0 },
    '1_30':  { count: 0, outstandingPaise: 0 },
    '31_60': { count: 0, outstandingPaise: 0 },
    '61_90': { count: 0, outstandingPaise: 0 },
    '90_PLUS': { count: 0, outstandingPaise: 0 },
  };
  let total = 0;
  const now = Date.now();
  for (const o of unpaid) {
    // For AR, count "overdue" as 7+ days after placement (loose proxy)
    const daysOverdue = Math.floor((now - new Date(o.createdAt).getTime()) / 86_400_000) - 7;
    const bucket = bucketBy(daysOverdue);
    buckets[bucket].count += 1;
    buckets[bucket].outstandingPaise += o.total;
    total += o.total;
  }
  return {
    buckets: (['CURRENT', '1_30', '31_60', '61_90', '90_PLUS'] as const).map(b => ({
      bucket: b,
      label: LABELS[b],
      count: buckets[b].count,
      outstandingPaise: buckets[b].outstandingPaise,
    })),
    totalOutstandingPaise: total,
  };
}
