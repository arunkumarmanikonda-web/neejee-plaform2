// GET  /api/admin/finance/ai-summary?limit=10   — list past summaries
// POST /api/admin/finance/ai-summary            — generate now (on-demand)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { generateWeeklySummary } from '@/lib/finance/ai-summary';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const limit = Math.min(parseInt(new URL(req.url).searchParams.get('limit') || '10'), 50);
    const rows = await prisma.financeAiSummary.findMany({
      orderBy: { generatedAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ summaries: rows });
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
    const body = await req.json().catch(() => ({}));
    const sendEmail = body?.sendEmail !== false;
    const result = await generateWeeklySummary({ sendEmail });
    return NextResponse.json(result);
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    console.error('[finance.ai-summary.generate]', err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
