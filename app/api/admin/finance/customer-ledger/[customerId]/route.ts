// v23.40.11 — Customer ledger DETAIL: full transaction history.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { customerId: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const customer = await prisma.customer.findUnique({
    where: { id: params.customerId },
  });
  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const invoices = await prisma.salesInvoice.findMany({
    where: { customerId: params.customerId },
    orderBy: { issuedOn: 'desc' },
    include: {
      payments: { orderBy: { paidOn: 'desc' } },
    },
  });

  // Build a unified ledger: each invoice = debit, each payment = credit
  type Entry = {
    date: Date;
    type: 'INVOICE' | 'PAYMENT' | 'REFUND';
    refId: string;
    description: string;
    debitPaise: number;    // customer owes us
    creditPaise: number;   // customer paid us
    runningBalancePaise: number;
    invoiceNumber?: string | null;
    method?: string | null;
    reference?: string | null;
    paymentStatus?: string | null;
  };
  const entries: Entry[] = [];

  for (const inv of invoices) {
    entries.push({
      date: inv.issuedOn,
      type: 'INVOICE',
      refId: inv.id,
      description: `Invoice ${inv.invoiceNumber}${inv.invoiceType === 'POS' ? ' (POS)' : ''}`,
      debitPaise: inv.totalPaise,
      creditPaise: 0,
      runningBalancePaise: 0, // filled after sort
      invoiceNumber: inv.invoiceNumber,
      paymentStatus: inv.paymentStatus,
    });
    for (const p of inv.payments) {
      // v23.40.12 — Refunds are stored as SalesInvoicePayment with NEGATIVE
      // amountPaise. We surface them as REFUND entries (debit, not credit) so
      // the customer ledger shows: invoice debit → payment credit → refund debit.
      const isRefund = p.amountPaise < 0;
      entries.push({
        date: p.paidOn,
        type: isRefund ? 'REFUND' : 'PAYMENT',
        refId: p.id,
        description: isRefund
          ? `Refund vs ${inv.invoiceNumber}${p.notes ? ` — ${p.notes}` : ''}`
          : `Payment vs ${inv.invoiceNumber}`,
        debitPaise:  isRefund ? Math.abs(p.amountPaise) : 0,
        creditPaise: isRefund ? 0 : p.amountPaise,
        runningBalancePaise: 0,
        invoiceNumber: inv.invoiceNumber,
        method: p.method,
        reference: p.reference,
      });
    }
  }

  // Sort chronologically (oldest first for running balance)
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  let running = 0;
  for (const e of entries) {
    running += e.debitPaise - e.creditPaise;
    e.runningBalancePaise = running;
  }
  // Re-reverse for display (newest first)
  entries.reverse();

  // Summary
  const now = new Date();
  let totalBilled = 0, totalReceived = 0, outstanding = 0;
  let bucketCurrent = 0, bucket1_30 = 0, bucket31_60 = 0, bucket61_90 = 0, bucket90Plus = 0;
  for (const inv of invoices) {
    if (inv.paymentStatus === 'CANCELLED' || inv.paymentStatus === 'VOID') continue;
    totalBilled   += inv.totalPaise;
    totalReceived += inv.paidPaise;
    const out = inv.totalPaise - inv.paidPaise;
    if (out > 0 && inv.dueOn) {
      outstanding += out;
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueOn).getTime()) / 86_400_000);
      if (daysOverdue <= 0)       bucketCurrent += out;
      else if (daysOverdue <= 30) bucket1_30    += out;
      else if (daysOverdue <= 60) bucket31_60   += out;
      else if (daysOverdue <= 90) bucket61_90   += out;
      else                        bucket90Plus  += out;
    } else if (out > 0) {
      outstanding += out;
      bucketCurrent += out;
    }
  }

  return NextResponse.json({
    customer,
    ledger: entries,
    summary: {
      invoiceCount: invoices.length,
      totalBilled,
      totalReceived,
      outstanding,
      bucketCurrent, bucket1_30, bucket31_60, bucket61_90, bucket90Plus,
    },
  });
}

// PATCH — update customer profile (credit limit, address, etc.)
export async function PATCH(req: Request, { params }: { params: { customerId: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const updatable: any = {};
  for (const k of [
    'displayName', 'legalName', 'primaryEmail', 'primaryPhone',
    'gstin', 'pan', 'placeOfSupply', 'billingAddress', 'shippingAddress',
    'customerType', 'channel', 'status', 'notes',
  ]) {
    if (body[k] !== undefined) updatable[k] = body[k];
  }
  if (body.creditLimitPaise !== undefined) updatable.creditLimitPaise = parseInt(body.creditLimitPaise) || 0;
  if (body.creditDays       !== undefined) updatable.creditDays       = parseInt(body.creditDays) || 0;

  const customer = await prisma.customer.update({
    where: { id: params.customerId },
    data: updatable,
  });
  return NextResponse.json({ customer });
}
