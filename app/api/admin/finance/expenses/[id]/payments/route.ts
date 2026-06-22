// v23.40.2 — Expense payments
// POST /api/admin/finance/expenses/:id/payments
//   body: { amountPaise, paidOn, method?, reference?, notes?, receiptUrl?, attachments? }
//
// Creates an ExpensePayment row + updates Expense.paidPaise / paymentStatus
// in a single transaction. The payment will then appear in the vendor ledger
// (if the expense has a vendorId).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const payments = await prisma.expensePayment.findMany({
    where: { expenseId: params.id },
    orderBy: { paidOn: 'desc' },
  });
  return NextResponse.json({ payments });
}

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

    const expense = await prisma.expense.findUnique({
      where: { id: params.id },
      select: { id: true, totalPaise: true, paidPaise: true, status: true, vendorId: true, description: true },
    });
    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    if (expense.status === 'REJECTED' || expense.status === 'VOIDED') {
      return NextResponse.json({ error: `Cannot record payment on ${expense.status} expense` }, { status: 400 });
    }

    const outstanding = expense.totalPaise - expense.paidPaise;
    if (amt > outstanding) {
      return NextResponse.json({
        error: `Payment ${amt / 100} exceeds outstanding ${outstanding / 100}`,
      }, { status: 400 });
    }

    const atts: string[] = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
    const primaryReceipt = receiptUrl || atts[0] || null;

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.expensePayment.create({
        data: {
          id: 'epay_' + randomBytes(10).toString('hex'),
          expenseId: params.id,
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

      const newPaid = expense.paidPaise + amt;
      const newStatus =
        newPaid >= expense.totalPaise ? 'PAID' :
        newPaid > 0                   ? 'PARTIALLY_PAID' :
                                        'UNPAID';

      const updatedExpense = await tx.expense.update({
        where: { id: params.id },
        data: {
          paidPaise: newPaid,
          paymentStatus: newStatus,
          // Stamp paidOn on first payment (cash-basis convenience)
          paidOn: newPaid > 0 ? new Date(paidOn) : null,
        },
      });

      return { payment, expense: updatedExpense };
    });

    await recordAudit({
      action: 'CREATE',
      entityType: 'ExpensePayment',
      entityId: result.payment.id,
      after: result.payment,
      session,
      req,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to record payment' }, { status: 500 });
  }
}
