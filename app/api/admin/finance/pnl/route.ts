// GET /api/admin/finance/pnl?basis=cash|accrual&preset=this_month&from=&to=
// Returns the computed P&L report.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { computePnl, computeMarketingAttribution } from '@/lib/finance/pnl';
import { resolvePeriod } from '@/lib/finance/period';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// P&L is read-heavy; give it more headroom.
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const url = new URL(req.url);
    const basisParam = url.searchParams.get('basis');
    const basis: 'cash' | 'accrual' = basisParam === 'cash' ? 'cash' : 'accrual';

    const period = resolvePeriod(
      url.searchParams.get('preset') || undefined,
      url.searchParams.get('from') || undefined,
      url.searchParams.get('to') || undefined,
    );

    const includeAttribution = url.searchParams.get('attribution') !== 'false';

    const [pnl, attribution] = await Promise.all([
      computePnl(period, basis),
      includeAttribution
        ? computeMarketingAttribution(period, basis).catch(() => [])
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ pnl, attribution });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    console.error('[finance.pnl]', err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
