// v23.40.14 — Period Close API: list locks, run pre-close validations.
//
// GET  /api/admin/finance/period-close                 — list all PeriodLock rows
// GET  /api/admin/finance/period-close?check=YYYY-MM   — pre-close validation for that month

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const checkMonth = url.searchParams.get('check'); // YYYY-MM

  // List all existing locks (most recent first)
  const locks = await prisma.periodLock.findMany({
    orderBy: { monthBucket: 'desc' },
  });

  if (!checkMonth) return NextResponse.json({ locks });

  // ── Pre-close validation for the given month ───────────────────────
  // Build a date range that covers the month
  const [yStr, mStr] = checkMonth.split('-');
  const year  = parseInt(yStr);
  const month = parseInt(mStr) - 1; // 0-indexed
  if (Number.isNaN(year) || Number.isNaN(month)) {
    return NextResponse.json({ error: 'check must be YYYY-MM' }, { status: 400 });
  }
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 1);

  const issues: { code: string; severity: 'BLOCKER' | 'WARN'; count: number; message: string }[] = [];

  // 1. Draft / pending expenses in this period
  const draftExpenses = await prisma.expense.count({
    where: {
      incurredOn: { gte: monthStart, lt: monthEnd },
      status: { in: ['DRAFT', 'PENDING'] },
    },
  });
  if (draftExpenses > 0) {
    issues.push({ code: 'DRAFT_EXPENSES', severity: 'BLOCKER', count: draftExpenses,
      message: `${draftExpenses} expense(s) still in DRAFT/PENDING. Approve or reject before closing.` });
  }

  // 2. Sales invoices not posted to ledger
  const unposted = await prisma.salesInvoice.count({
    where: {
      issuedOn: { gte: monthStart, lt: monthEnd },
      posted:   false,
      paymentStatus: { notIn: ['CANCELLED', 'VOID'] },
    },
  });
  if (unposted > 0) {
    issues.push({ code: 'UNPOSTED_INVOICES', severity: 'BLOCKER', count: unposted,
      message: `${unposted} sales invoice(s) not yet posted to the revenue ledger. Post them first.` });
  }

  // 3. Unmatched bank transactions
  let unmatchedBank = 0;
  try {
    unmatchedBank = await prisma.bankTransaction.count({
      where: {
        txnDate: { gte: monthStart, lt: monthEnd },
        status: 'UNMATCHED',
      },
    });
  } catch { /* table may not be populated yet */ }
  if (unmatchedBank > 0) {
    issues.push({ code: 'UNMATCHED_BANK', severity: 'WARN', count: unmatchedBank,
      message: `${unmatchedBank} bank txn(s) unmatched. Reconcile before close for clean cash position.` });
  }

  // 4. Open bills (AP) for the period that are past due
  const overdueBills = await prisma.bill.count({
    where: {
      issuedOn: { gte: monthStart, lt: monthEnd },
      status:   { in: ['OPEN', 'OVERDUE'] },
      dueOn:    { lt: new Date() },
    },
  });
  if (overdueBills > 0) {
    issues.push({ code: 'OVERDUE_BILLS', severity: 'WARN', count: overdueBills,
      message: `${overdueBills} bill(s) past due. Settle or move to next period.` });
  }

  // 5. ACCRUED revenue entries that should have been REALIZED by now
  const stuckAccrued = await prisma.revenueEntry.count({
    where: {
      monthBucket: checkMonth,
      status: 'ACCRUED',
      type: { in: ['PRODUCT_REVENUE', 'COMMISSION_INCOME', 'SHIPPING_REVENUE'] },
    },
  });
  if (stuckAccrued > 0) {
    issues.push({ code: 'STUCK_ACCRUED', severity: 'WARN', count: stuckAccrued,
      message: `${stuckAccrued} revenue entries still ACCRUED. Mark realized when cash received.` });
  }

  const alreadyLocked = locks.find(l => l.monthBucket === checkMonth);
  const blockers = issues.filter(i => i.severity === 'BLOCKER').length;

  return NextResponse.json({
    locks,
    check: {
      monthBucket: checkMonth,
      alreadyLocked: !!alreadyLocked,
      lockedAt: alreadyLocked?.lockedAt || null,
      issues,
      canClose: blockers === 0 && !alreadyLocked,
      blockerCount: blockers,
      warnCount: issues.length - blockers,
    },
  });
}

// POST /api/admin/finance/period-close { monthBucket, notes? }   — close month
// DELETE /api/admin/finance/period-close { monthBucket }         — reopen month
export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { monthBucket, notes, force } = await req.json();
  if (!monthBucket || !/^\d{4}-\d{2}$/.test(monthBucket)) {
    return NextResponse.json({ error: 'monthBucket required as YYYY-MM' }, { status: 400 });
  }

  // Re-run validations unless force=true
  if (!force) {
    const [yStr, mStr] = monthBucket.split('-');
    const monthStart = new Date(parseInt(yStr), parseInt(mStr) - 1, 1);
    const monthEnd   = new Date(parseInt(yStr), parseInt(mStr), 1);
    const blockers = await Promise.all([
      prisma.expense.count({ where: { incurredOn: { gte: monthStart, lt: monthEnd }, status: { in: ['DRAFT', 'PENDING'] } } }),
      prisma.salesInvoice.count({ where: { issuedOn: { gte: monthStart, lt: monthEnd }, posted: false, paymentStatus: { notIn: ['CANCELLED', 'VOID'] } } }),
    ]);
    if (blockers.some(c => c > 0)) {
      return NextResponse.json({ error: 'Blockers exist — resolve them or pass force=true' }, { status: 400 });
    }
  }

  const lock = await prisma.periodLock.upsert({
    where: { monthBucket },
    update: { notes: notes || null },
    create: {
      id: 'lock_' + Math.random().toString(36).slice(2, 12),
      monthBucket,
      lockedByUserId: session!.id,
      notes: notes || null,
    },
  });
  return NextResponse.json({ lock }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const monthBucket = url.searchParams.get('monthBucket');
  if (!monthBucket) return NextResponse.json({ error: 'monthBucket required' }, { status: 400 });

  await prisma.periodLock.delete({ where: { monthBucket } });
  return NextResponse.json({ reopened: monthBucket });
}
