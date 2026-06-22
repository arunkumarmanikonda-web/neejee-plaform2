// v23.40.6 — Admin-triggered manual commission billing run.
// POST /api/admin/finance/commission/run
//   body: { fromDate?, toDate?, sellerId?, dryRun? }

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { runCommissionBilling } from '@/lib/finance/commission-engine';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json().catch(() => ({}));
    const result = await runCommissionBilling({
      fromDate: body.fromDate ? new Date(body.fromDate) : undefined,
      toDate:   body.toDate   ? new Date(body.toDate)   : undefined,
      sellerId: body.sellerId || undefined,
      dryRun:   !!body.dryRun,
      autoPost: body.autoPost !== false,
      byUserId: session!.id,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Run failed' }, { status: 500 });
  }
}
