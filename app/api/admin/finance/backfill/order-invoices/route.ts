// v23.40.9 — Backfill: create SalesInvoice + post revenue entries for past PAID orders.
// POST /api/admin/finance/backfill/order-invoices?dryRun=1 — preview
// POST /api/admin/finance/backfill/order-invoices            — execute
//   body (optional): { fromDate?, toDate? }

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { backfillOrderInvoices } from '@/lib/finance/post-order';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // up to 5 min for large catalogues

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const body = await req.json().catch(() => ({}));

  const result = await backfillOrderInvoices({
    fromDate: body.fromDate ? new Date(body.fromDate) : undefined,
    toDate:   body.toDate   ? new Date(body.toDate)   : undefined,
    dryRun,
    byUserId: session!.id,
  });
  return NextResponse.json(result);
}
