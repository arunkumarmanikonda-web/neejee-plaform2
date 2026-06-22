// Daily finance cron (Vercel — 06:00 IST = 00:30 UTC).
//   1. Run any due recurring expense templates → create Bills
//   2. Refresh OVERDUE statuses on bills past due date
//   3. Notify admins about new overdue bills (digest)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runRecurringExpenses } from '@/lib/finance/recurring';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return (req.headers.get('authorization') || '') === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const out: any = { ranAt: new Date().toISOString() };

  // 1. Recurring expense templates → bills
  try {
    out.recurring = await runRecurringExpenses();
  } catch (e: any) {
    out.recurringError = e?.message;
  }

  // 2. Mark overdue bills (status=OPEN AND dueOn < today - 1 day)
  try {
    const cutoff = new Date(Date.now() - 86_400_000);
    const result = await prisma.bill.updateMany({
      where: { status: 'OPEN', dueOn: { lt: cutoff } },
      data: { status: 'OVERDUE' },
    });
    out.overdueMarked = result.count;
  } catch (e: any) {
    out.overdueError = e?.message;
  }

  // 3. Digest: send a single email to admins listing overdue bills (best effort)
  try {
    const overdue = await prisma.bill.findMany({
      where: { status: 'OVERDUE' },
      orderBy: { dueOn: 'asc' },
      take: 20,
      select: { id: true, description: true, totalPaise: true, paidPaise: true, dueOn: true, vendorNameSnapshot: true },
    });
    if (overdue.length > 0) {
      const { notify } = await import('@/lib/notifications');
      const total = overdue.reduce((s, b) => s + (b.totalPaise - b.paidPaise), 0);
      notify({
        event: 'FINANCE_OVERDUE_DIGEST',
        toAdmins: true,
        data: {
          count: overdue.length,
          totalOutstanding: (total / 100).toLocaleString('en-IN'),
          firstFew: overdue.slice(0, 5).map(b =>
            `• ${b.description} — ₹${((b.totalPaise - b.paidPaise) / 100).toLocaleString('en-IN')} (due ${new Date(b.dueOn).toLocaleDateString('en-IN')})`
          ).join('\n'),
        },
      }).catch(() => {});
    }
    out.overdueNotified = overdue.length;
  } catch (e: any) {
    out.digestError = e?.message;
  }

  return NextResponse.json(out);
}
