// v23.40.12 — Backfill: post revenue reversals for orders that were already
// marked REFUNDED/CANCELLED before v23.40.12 went live.
//
// Walks every Order with status REFUNDED or CANCELLED that has an invoice but
// no REFUND_REVERSAL entries yet, and runs reverseOrderRevenue() for each.
//
// POST /api/admin/finance/backfill/refund-reversals?dryRun=1   — preview
// POST /api/admin/finance/backfill/refund-reversals            — execute

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { reverseOrderRevenue } from '@/lib/finance/reverse-order';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  // Find orders already refunded/cancelled with invoices still showing as PAID
  const candidates = await prisma.order.findMany({
    where: {
      status: { in: ['REFUNDED', 'CANCELLED'] },
    },
    select: { id: true, orderNumber: true, status: true, subtotal: true, paymentStatus: true },
  });

  const result = {
    scanned: candidates.length,
    reversed: 0,
    skipped: 0,
    failed: 0,
    samples: [] as { orderNumber: string; status: string; action: string }[],
    errors: [] as { orderId: string; error: string }[],
  };

  if (dryRun) {
    // Quick predict: how many have an invoice that's not already REFUNDED?
    let wouldReverse = 0;
    for (const o of candidates) {
      const inv = await prisma.salesInvoice.findUnique({
        where: { orderId: o.id },
        select: { paymentStatus: true, paidPaise: true },
      });
      if (inv && inv.paymentStatus !== 'REFUNDED' && inv.paymentStatus !== 'VOID' && inv.paidPaise > 0) {
        wouldReverse++;
        if (result.samples.length < 15) result.samples.push({ orderNumber: o.orderNumber, status: o.status, action: 'would reverse' });
      } else {
        if (result.samples.length < 15) result.samples.push({ orderNumber: o.orderNumber, status: o.status, action: inv ? 'already reversed' : 'no invoice' });
      }
    }
    result.reversed = wouldReverse;
    return NextResponse.json({ dryRun: true, result });
  }

  for (const o of candidates) {
    try {
      const inv = await prisma.salesInvoice.findUnique({
        where: { orderId: o.id },
        select: { paidPaise: true, paymentStatus: true },
      });
      if (!inv) { result.skipped++; continue; }
      if (inv.paymentStatus === 'REFUNDED' || inv.paymentStatus === 'VOID') { result.skipped++; continue; }
      if (inv.paidPaise <= 0) { result.skipped++; continue; }

      await reverseOrderRevenue({
        orderId: o.id,
        refundAmountPaise: inv.paidPaise,
        proportionReversed: 1,
        reason: `BACKFILL_${o.status}`,
        postedByUserId: session!.id,
      });
      result.reversed++;
      if (result.samples.length < 15) result.samples.push({ orderNumber: o.orderNumber, status: o.status, action: 'reversed' });
    } catch (err: any) {
      result.failed++;
      result.errors.push({ orderId: o.id, error: err.message || String(err) });
    }
  }

  return NextResponse.json({ dryRun: false, result });
}
