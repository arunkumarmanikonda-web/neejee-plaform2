// AP/AR aging report.
// GET /api/admin/finance/aging?type=ap|ar|both (default: both)
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { computeApAging, computeArAging } from '@/lib/finance/bills';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const type = new URL(req.url).searchParams.get('type') || 'both';
    const [ap, ar] = await Promise.all([
      (type === 'ap' || type === 'both') ? computeApAging() : Promise.resolve(null),
      (type === 'ar' || type === 'both') ? computeArAging() : Promise.resolve(null),
    ]);
    return NextResponse.json({
      ap, ar,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
