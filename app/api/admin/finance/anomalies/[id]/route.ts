// Acknowledge an anomaly alert.
// POST /api/admin/finance/anomalies/{id}/acknowledge
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const row = await prisma.financeAnomalyAlert.update({
      where: { id: params.id },
      data: { acknowledgedAt: new Date() },
    });
    return NextResponse.json({ alert: row });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
