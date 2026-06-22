// PATCH/DELETE one expense category.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EDITABLE = [
  'label', 'group', 'isMarketingChannel', 'approvalThresholdPaise',
  'gstInputClaimable', 'isActive', 'parentCategoryId',
] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const data: Record<string, any> = {};
    for (const k of EDITABLE) if (k in body) data[k] = body[k];

    const updated = await prisma.expenseCategory.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ category: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.delete');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    // Don't actually delete; archive instead to preserve historical expense lookups.
    const updated = await prisma.expenseCategory.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ category: updated, archived: true });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
