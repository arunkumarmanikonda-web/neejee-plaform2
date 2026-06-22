// Chart of accounts CRUD.
// GET /api/admin/finance/categories         — list all
// POST /api/admin/finance/categories        — create new category
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    let rows = await prisma.expenseCategory.findMany({
      orderBy: [{ group: 'asc' }, { label: 'asc' }],
    });
    // v23.38: auto-seed default Indian categories on first read if empty
    if (rows.length === 0) {
      const { seedExpenseCategories } = await import('@/lib/finance/seed-categories');
      await seedExpenseCategories();
      rows = await prisma.expenseCategory.findMany({
        orderBy: [{ group: 'asc' }, { label: 'asc' }],
      });
    }
    return NextResponse.json({ categories: rows });
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
    if (!body.code || !body.label || !body.group) {
      return NextResponse.json({ error: 'code, label and group are required' }, { status: 400 });
    }

    const created = await prisma.expenseCategory.create({
      data: {
        code: String(body.code).toUpperCase().trim(),
        label: String(body.label).trim(),
        group: body.group,
        isMarketingChannel: !!body.isMarketingChannel,
        approvalThresholdPaise: body.approvalThresholdPaise ?? null,
        gstInputClaimable: body.gstInputClaimable !== false,
        isActive: body.isActive !== false,
        parentCategoryId: body.parentCategoryId || null,
      },
    });
    return NextResponse.json({ category: created }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
