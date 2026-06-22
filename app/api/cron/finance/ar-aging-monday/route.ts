// v23.40.19 — Monday AR Aging alert (08:00 IST every Monday).
// Sends a Slack message with top overdue customers + bucket breakdown.
// Same data the /admin/finance/customer-ledger page shows.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { postSlack, slack } from '@/lib/notifications/slack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function fmtINR(paise: number): string {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export async function GET(req: Request) {
  // Vercel cron secret check — same pattern as existing crons
  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    // Allow unauthenticated only when CRON_SECRET unset (dev)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  // Pull every open sales invoice
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      paymentStatus: { notIn: ['PAID', 'CANCELLED', 'VOID'] },
    },
    select: {
      id: true, invoiceNumber: true, totalPaise: true, paidPaise: true,
      dueOn: true, customerId: true, customerName: true,
    },
  });

  // Aggregate by customer + aging bucket
  const byCustomer = new Map<string, {
    name: string; outstanding: number; overdue: number; invoiceCount: number;
  }>();
  let bucketCurrent = 0, b1_30 = 0, b31_60 = 0, b61_90 = 0, b90Plus = 0;
  let totalOutstanding = 0, totalOverdue = 0;

  for (const inv of invoices) {
    const outstanding = inv.totalPaise - inv.paidPaise;
    if (outstanding <= 0) continue;
    totalOutstanding += outstanding;

    const key = inv.customerId || `name:${inv.customerName}`;
    const cur = byCustomer.get(key) || { name: inv.customerName, outstanding: 0, overdue: 0, invoiceCount: 0 };
    cur.outstanding += outstanding;
    cur.invoiceCount++;

    if (inv.dueOn) {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueOn).getTime()) / 86_400_000);
      if (daysOverdue > 0) {
        cur.overdue   += outstanding;
        totalOverdue  += outstanding;
      }
      if (daysOverdue <= 0)       bucketCurrent += outstanding;
      else if (daysOverdue <= 30) b1_30  += outstanding;
      else if (daysOverdue <= 60) b31_60 += outstanding;
      else if (daysOverdue <= 90) b61_90 += outstanding;
      else                        b90Plus += outstanding;
    } else {
      bucketCurrent += outstanding;
    }
    byCustomer.set(key, cur);
  }

  // Top 5 overdue customers
  const top = Array.from(byCustomer.values())
    .filter(c => c.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 5);

  // If everything is clean — short positive message
  if (totalOverdue === 0) {
    await postSlack('finance', {
      text: ':sparkles: AR clean — no overdue invoices this morning. Have a great week.',
      blocks: [
        slack.header(':sparkles: AR clean'),
        slack.section(`No overdue invoices outstanding. Total open: ${fmtINR(totalOutstanding)}.`),
        slack.context(`Generated ${now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`),
      ],
    });
    return NextResponse.json({ ok: true, sent: 'clean', totalOpen: totalOutstanding });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
  const blocks = [
    slack.header(':warning: Monday AR Aging'),
    slack.section(`*Total outstanding:* ${fmtINR(totalOutstanding)}\n*Overdue:* ${fmtINR(totalOverdue)} across ${top.length} customer(s)`),
    slack.divider(),
    slack.fields([
      ['Current',       fmtINR(bucketCurrent)],
      ['1 – 30 days',   fmtINR(b1_30)],
      ['31 – 60 days',  fmtINR(b31_60)],
      ['61 – 90 days',  fmtINR(b61_90)],
      ['90+ days',      fmtINR(b90Plus)],
    ]),
    slack.divider(),
    slack.section('*Top overdue customers:*\n' + top.map(c =>
      `• ${c.name} — *${fmtINR(c.overdue)}* overdue (${c.invoiceCount} invoice${c.invoiceCount === 1 ? '' : 's'})`
    ).join('\n')),
    slack.button('Open customer ledgers', `${base}/admin/finance/customer-ledger`),
  ];

  const result = await postSlack('finance', {
    text: `Monday AR: ${fmtINR(totalOverdue)} overdue across ${top.length} customer(s).`,
    blocks,
  });

  return NextResponse.json({
    ok: result.ok,
    totalOutstanding,
    totalOverdue,
    overdueCustomerCount: top.length,
    buckets: { current: bucketCurrent, b1_30, b31_60, b61_90, b90Plus },
  });
}
