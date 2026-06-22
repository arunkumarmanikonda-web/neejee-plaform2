// One-bill: get, patch (limited fields), cancel.
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
    const bill = await prisma.bill.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        payments: { orderBy: { paidOn: 'desc' } },
      },
    });
    if (!bill) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ bill });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

const EDITABLE = [
  'billNumber', 'description', 'vendorNameSnapshot', 'amountPaise', 'gstPaise',
  'issuedOn', 'dueOn', 'receiptUrl', 'notes', 'categoryId',
] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  try {
    const existing = await prisma.bill.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'PAID' || existing.status === 'CANCELLED') {
      return NextResponse.json({ error: `Cannot edit a ${existing.status} bill` }, { status: 400 });
    }

    const body = await req.json();
    const data: any = {};
    for (const k of EDITABLE) {
      if (k in body) {
        if (k === 'issuedOn' || k === 'dueOn') data[k] = body[k] ? new Date(body[k]) : existing[k];
        else data[k] = body[k];
      }
    }
    if ('amountPaise' in data || 'gstPaise' in data) {
      const amt = data.amountPaise ?? existing.amountPaise;
      const gst = data.gstPaise ?? existing.gstPaise;
      data.totalPaise = amt + gst;
    }
    if (body.status === 'CANCELLED') data.status = 'CANCELLED';

    const updated = await prisma.bill.update({
      where: { id: params.id },
      data,
      include: { category: true, payments: true },
    });
    return NextResponse.json({ bill: updated });
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
    const existing = await prisma.bill.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.paidPaise > 0) {
      return NextResponse.json({ error: 'Cannot delete a bill with payments — cancel it instead' }, { status: 400 });
    }
    await prisma.bill.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
