// GET  /api/admin/finance/anomalies        — live detection + recent persisted alerts
// POST /api/admin/finance/anomalies         — persist current detections (called by cron or on-demand)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { detectAnomalies, persistAnomalies } from '@/lib/finance/anomaly';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const [live, recent] = await Promise.all([
      detectAnomalies(),
      prisma.financeAnomalyAlert.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return NextResponse.json({ live, recent });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const inserted = await persistAnomalies();
    return NextResponse.json({ inserted });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
