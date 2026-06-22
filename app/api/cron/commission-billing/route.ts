// v23.40.6 — Weekly commission billing cron.
// Runs every Monday at 03:00 UTC. Bills commissions on marketplace orders
// delivered in the previous 7 days.
//
// Vercel cron entry: { path: '/api/cron/commission-billing', schedule: '0 3 * * 1' }
//
// Manual trigger:   curl 'https://www.neejee.com/api/cron/commission-billing?key=<CRON_SECRET>'

import { NextResponse } from 'next/server';
import { runCommissionBilling } from '@/lib/finance/commission-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.CRON_SECRET;
  const provided = url.searchParams.get('key') ||
    (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Default window: last 7 days
  const toDate   = new Date();
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Allow optional overrides via query params (admin / manual run)
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');
  const dry  = url.searchParams.get('dryRun') === '1';
  const sellerId = url.searchParams.get('sellerId') || undefined;

  const result = await runCommissionBilling({
    fromDate: from ? new Date(from) : fromDate,
    toDate:   to   ? new Date(to)   : toDate,
    sellerId,
    dryRun: dry,
    byUserId: 'system_cron',
  });

  return NextResponse.json({ ok: true, result });
}
