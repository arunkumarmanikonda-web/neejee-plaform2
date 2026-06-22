// One recurring template — patch (pause/resume/edit) or delete.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const EDITABLE = ['name', 'amountPaise', 'gstPaise', 'frequency', 'dayOfMonth', 'dueOffsetDays', 'active', 'nextRunDate', 'vendorNameSnapshot'] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const body = await req.json();
    const data: any = {};
    for (const k of EDITABLE) {
      if (k in body) {
        if (k === 'nextRunDate') data[k] = body[k] ? new Date(body[k]) : null;
        else data[k] = body[k];
      }
    }
    if ('amountPaise' in data || 'gstPaise' in data) {
      const existing = await prisma.recurringExpense.findUnique({ where: { id: params.id } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const amt = data.amountPaise ?? existing.amountPaise;
      const gst = data.gstPaise ?? existing.gstPaise;
      data.totalPaise = amt + gst;
    }
    const row = await prisma.recurringExpense.update({ where: { id: params.id }, data });
    return NextResponse.json({ template: row });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    await prisma.recurringExpense.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
