// Monthly marketing budgets per channel.
// GET /api/admin/finance/marketing/budgets?year=&month=
// POST /api/admin/finance/marketing/budgets  body: { expenseCategoryId, periodYear, periodMonth, budgetPaise }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get('year') || '0');
    const month = parseInt(url.searchParams.get('month') || '0');

    const where: any = {};
    if (year) where.periodYear = year;
    if (month) where.periodMonth = month;

    const rows = await prisma.marketingBudget.findMany({
      where,
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
    return NextResponse.json({ budgets: rows });
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
    const body = await req.json();
    const { expenseCategoryId, periodYear, periodMonth, budgetPaise, notes } = body;
    if (!expenseCategoryId || !periodYear || !periodMonth || budgetPaise == null) {
      return NextResponse.json({
        error: 'expenseCategoryId, periodYear, periodMonth, budgetPaise required',
      }, { status: 400 });
    }

    // Upsert by (categoryId, year, month)
    const row = await prisma.marketingBudget.upsert({
      where: {
        expenseCategoryId_periodYear_periodMonth: {
          expenseCategoryId,
          periodYear: parseInt(periodYear),
          periodMonth: parseInt(periodMonth),
        },
      },
      update: {
        budgetPaise: parseInt(budgetPaise),
        notes: notes || null,
      },
      create: {
        expenseCategoryId,
        periodYear: parseInt(periodYear),
        periodMonth: parseInt(periodMonth),
        budgetPaise: parseInt(budgetPaise),
        notes: notes || null,
        createdByUserId: session!.id,
      },
    });
    return NextResponse.json({ budget: row });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
