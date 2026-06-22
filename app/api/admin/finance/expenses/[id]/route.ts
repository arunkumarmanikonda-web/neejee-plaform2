// One-expense ops: get, update (only DRAFT/PENDING), delete (DRAFT only).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const row = await prisma.expense.findUnique({
      where: { id: params.id },
      include: { category: true },
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ expense: row });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

const EDITABLE = [
  'description', 'amountPaise', 'gstPaise', 'incurredOn', 'paidOn',
  'vendorId', 'vendorNameSnapshot', 'invoiceNumber', 'receiptUrl', 'orderId', 'notes',
] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const existing = await prisma.expense.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'APPROVED' || existing.status === 'REJECTED') {
      return NextResponse.json({
        error: `Cannot edit a ${existing.status} expense. Create a new entry or unapprove first.`,
      }, { status: 400 });
    }

    const body = await req.json();
    const data: any = {};
    for (const k of EDITABLE) {
      if (k in body) {
        if (k === 'incurredOn' || k === 'paidOn') {
          data[k] = body[k] ? new Date(body[k]) : null;
        } else {
          data[k] = body[k];
        }
      }
    }
    // Recompute totalPaise if needed
    if ('amountPaise' in data || 'gstPaise' in data) {
      const amt = data.amountPaise ?? existing.amountPaise;
      const gst = data.gstPaise ?? existing.gstPaise;
      data.totalPaise = amt + gst;
    }

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data,
      include: { category: true },
    });
    return NextResponse.json({ expense: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const existing = await prisma.expense.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status !== 'DRAFT') {
      return NextResponse.json({
        error: 'Only DRAFT expenses can be deleted. Use reject for pending entries.',
      }, { status: 400 });
    }
    await prisma.expense.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
