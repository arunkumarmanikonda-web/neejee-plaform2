// v23.40.5 — Sales Invoice detail / cancel / re-post
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { postSalesInvoice, reverseInvoice } from '@/lib/finance/post-revenue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: params.id },
    include: {
      lines:    true,
      payments: { orderBy: { paidOn: 'desc' } },
    },
  });
  if (!invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const revenueEntries = await prisma.revenueEntry.findMany({
    where: { invoiceId: params.id },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ invoice, revenueEntries });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const before = await prisma.salesInvoice.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: any = {};
  if (body.notes !== undefined)         data.notes = body.notes;
  if (Array.isArray(body.attachments))  data.attachments = body.attachments.filter(Boolean);
  if (body.dueOn !== undefined)         data.dueOn = body.dueOn ? new Date(body.dueOn) : null;

  // Status transitions
  if (body.action === 'cancel') {
    if (before.paymentStatus === 'PAID') {
      return NextResponse.json({ error: 'Cannot cancel a paid invoice. Issue a credit note instead.' }, { status: 400 });
    }
    data.paymentStatus = 'CANCELLED';
    // Reverse any posted entries
    if (before.posted) await reverseInvoice(params.id, session!.id);
  }
  if (body.action === 'repost') {
    await postSalesInvoice(params.id, session!.id);
  }
  if (body.action === 'reverse') {
    await reverseInvoice(params.id, session!.id);
  }

  const updated = await prisma.salesInvoice.update({ where: { id: params.id }, data });
  await recordAudit({
    action: 'UPDATE', entityType: 'SalesInvoice', entityId: params.id,
    before, after: updated, session, req,
  });
  return NextResponse.json({ invoice: updated });
}
