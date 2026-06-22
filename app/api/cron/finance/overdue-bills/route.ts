// v23.40.19 — Daily Overdue Bills (AP) alert.
// Posts to Slack every morning if any vendor bill is past its due date.
// Quiet if nothing is overdue.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { postSlack, slack } from '@/lib/notifications/slack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function fmtINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function daysSince(d: Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const overdue = await prisma.bill.findMany({
    where: {
      status: { in: ['OPEN', 'OVERDUE', 'PARTIALLY_PAID'] },
      dueOn:  { lt: new Date() },
    },
    select: {
      id: true, billNumber: true, vendorNameSnapshot: true, vendorId: true,
      totalPaise: true, paidPaise: true, dueOn: true,
    },
    orderBy: { dueOn: 'asc' },
  });

  if (overdue.length === 0) {
    // Stay silent on quiet days — avoid alert fatigue
    return NextResponse.json({ ok: true, sent: false, count: 0 });
  }

  let total = 0;
  for (const b of overdue) total += b.totalPaise - b.paidPaise;

  const top = overdue.slice(0, 8).map(b => {
    const out = b.totalPaise - b.paidPaise;
    const days = daysSince(b.dueOn);
    return `• *${b.vendorNameSnapshot || 'Unknown vendor'}* — ${fmtINR(out)} (${days}d overdue${b.billNumber ? `, #${b.billNumber}` : ''})`;
  }).join('\n');

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
  const blocks = [
    slack.header(':rotating_light: Overdue Bills'),
    slack.section(`*${overdue.length}* bill(s) past due. Total outstanding: *${fmtINR(total)}*.`),
    slack.divider(),
    slack.section(top + (overdue.length > 8 ? `\n_…and ${overdue.length - 8} more._` : '')),
    slack.button('Open Bills (AP)', `${base}/admin/finance/bills?status=OVERDUE`),
  ];

  const result = await postSlack('finance', {
    text: `🚨 ${overdue.length} overdue bill(s) — ${fmtINR(total)} owed to vendors.`,
    blocks,
    icon_emoji: ':warning:',
  });

  return NextResponse.json({
    ok: result.ok,
    overdueCount: overdue.length,
    totalOverduePaise: total,
  });
}
