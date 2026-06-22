// v23.40.19 — Monthly GST reconciliation snapshot.
// Runs on the 1st of every month at 09:00 IST for the previous month.
// Posts the GSTR-3B summary to Slack so the team has filing data ready.

import { NextResponse } from 'next/server';
import { postSlack, slack } from '@/lib/notifications/slack';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function previousMonthBucket(): string {
  const d = new Date();
  d.setDate(1);              // move to first of current month
  d.setMonth(d.getMonth() - 1); // step back into previous month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function fmtINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const month = previousMonthBucket();
  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';

  // Hit our own GSTR-3B helper API for the actual numbers
  let summary: any = null;
  try {
    const r = await fetch(`${base}/api/admin/finance/gstr-3b?month=${month}`, {
      headers: { 'X-Internal-Cron': process.env.CRON_SECRET || '' },
    });
    if (r.ok) summary = await r.json();
  } catch (e: any) {
    console.warn('[gst-reco] fetch failed:', e?.message);
  }

  if (!summary?.boxes) {
    await postSlack('finance', {
      text: `:information_source: GST reco — could not compute GSTR-3B for ${month}. Check /admin/finance/period-close.`,
    });
    return NextResponse.json({ ok: false, error: 'no-data' });
  }

  const b31a = summary.boxes['3.1(a) Taxable outward (other than zero-rated, nil-rated, exempt)'];
  const b4c  = summary.boxes['4(C) Net ITC available'];
  const b61  = summary.boxes['6.1 Tax payable (net)'];

  const blocks = [
    slack.header(`:scroll: GSTR-3B for ${month}`),
    slack.section(`Filing data ready. *Net tax payable: ${fmtINR(b61.total)}*.`),
    slack.divider(),
    slack.fields([
      ['Outward taxable', fmtINR(b31a.taxableValue)],
      ['CGST output',     fmtINR(b31a.cgst)],
      ['SGST output',     fmtINR(b31a.sgst)],
      ['IGST output',     fmtINR(b31a.igst)],
      ['Net ITC',         fmtINR(b4c.total)],
      ['Tax payable',     fmtINR(b61.total)],
    ]),
    slack.divider(),
    slack.section(`*Invoices:* ${summary.counts.outwardInvoices} outward, ${summary.counts.inwardBills} inward bills, ${summary.counts.refundReversals} refund reversals.`),
    slack.button('Open GSTR-3B helper', `${base}/admin/finance/period-close`),
    slack.context('Reminder: file GSTR-3B by the 20th of this month, then lock the period.'),
  ];

  const result = await postSlack('finance', {
    text: `📜 GSTR-3B ${month} ready · Net payable ${fmtINR(b61.total)}.`,
    blocks,
    icon_emoji: ':scroll:',
  });

  return NextResponse.json({ ok: result.ok, month, summary });
}
