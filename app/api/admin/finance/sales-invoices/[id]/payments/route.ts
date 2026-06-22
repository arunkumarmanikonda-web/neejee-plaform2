// v23.40.5 — Record a payment against a Sales Invoice and realize the revenue.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { realizeInvoicePayments } from '@/lib/finance/post-revenue';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const { amountPaise, paidOn, method, reference, notes, receiptUrl, attachments } = body;
    if (!amountPaise || !paidOn) {
      return NextResponse.json({ error: 'amountPaise and paidOn are required' }, { status: 400 });
    }
    const amt = parseInt(String(amountPaise));
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'amountPaise must be a positive integer' }, { status: 400 });
    }

    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: params.id },
      select: { id: true, totalPaise: true, paidPaise: true, paymentStatus: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (invoice.paymentStatus === 'CANCELLED' || invoice.paymentStatus === 'VOID') {
      return NextResponse.json({ error: `Cannot record payment on ${invoice.paymentStatus} invoice` }, { status: 400 });
    }
    const outstanding = invoice.totalPaise - invoice.paidPaise;
    if (amt > outstanding) {
      return NextResponse.json({
        error: `Payment ₹${amt / 100} exceeds outstanding ₹${outstanding / 100}`,
      }, { status: 400 });
    }

    const atts: string[] = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
    const primaryReceipt = receiptUrl || atts[0] || null;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.salesInvoicePayment.create({
        data: {
          id: 'spay_' + randomBytes(10).toString('hex'),
          invoiceId: params.id,
          amountPaise: amt,
          paidOn: new Date(paidOn),
          method: method || null,
          reference: reference || null,
          notes: notes || null,
          receiptUrl: primaryReceipt,
          attachments: atts,
          createdByUserId: session!.id,
        },
      });
      const newPaid = invoice.paidPaise + amt;
      const newStatus = newPaid >= invoice.totalPaise ? 'PAID'
                      : newPaid > 0                  ? 'PARTIALLY_PAID'
                                                     : 'UNPAID';
      const updatedInvoice = await tx.salesInvoice.update({
        where: { id: params.id },
        data: { paidPaise: newPaid, paymentStatus: newStatus },
      });
      return { payment, invoice: updatedInvoice };
    });

    // If now fully paid, mark all revenue entries on this invoice as REALIZED
    if (result.invoice.paymentStatus === 'PAID') {
      await realizeInvoicePayments(params.id, new Date(paidOn), reference);
    }

    await recordAudit({
      action: 'CREATE',
      entityType: 'SalesInvoicePayment',
      entityId: result.payment.id,
      after: result.payment,
      session, req,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to record payment' }, { status: 500 });
  }
}
