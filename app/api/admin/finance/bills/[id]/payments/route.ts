// Bill payments — add a payment, list payments.
// POST /api/admin/finance/bills/{id}/payments
//   body: { amountPaise, paidOn, method?, reference?, notes? }
// Automatically:
//   • recomputes Bill.paidPaise and Bill.status (PAID / PARTIALLY_PAID)
//   • optionally creates an Expense row (POST with autoExpense: true)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm, canApproveFinance } from '@/lib/finance/roles';
import { recomputeBillStatus } from '@/lib/finance/bills';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { randomBytes } from 'crypto';
import { recordAudit } from '@/lib/finance/audit-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const { amountPaise, paidOn, method, reference, notes, receiptUrl, attachments, autoExpense = true } = body;
    const atts: string[] = Array.isArray(attachments) ? attachments.filter(Boolean) : [];

    const bill = await prisma.bill.findUnique({
      where: { id: params.id },
      include: {
        category: { select: { id: true, label: true, approvalThresholdPaise: true } },
      },
    }) as any; // tolerate generated client lag for the new expenseId field
    if (!bill) return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    if (bill.status === 'CANCELLED' || bill.status === 'PAID') {
      return NextResponse.json({ error: `Cannot pay a ${bill.status} bill` }, { status: 400 });
    }

    const amt = parseInt(amountPaise);
    if (!amt || amt <= 0) return NextResponse.json({ error: 'amountPaise must be > 0' }, { status: 400 });
    const remaining = bill.totalPaise - bill.paidPaise;
    if (amt > remaining) {
      return NextResponse.json({
        error: `Payment ${amt} exceeds outstanding ${remaining}`,
      }, { status: 400 });
    }

    // Create the payment + (optional) Expense row in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.billPayment.create({
        data: {
          id: 'pay_' + randomBytes(10).toString('hex'),
          billId: bill.id,
          amountPaise: amt,
          paidOn: new Date(paidOn || new Date()),
          method: method || null,
          reference: reference || null,
          notes: notes || null,
          receiptUrl: receiptUrl || atts[0] || null,  // v23.38
          attachments: atts,                            // v23.39.4
          createdByUserId: session!.id,
        },
      });

      // v23.40.10 — CASCADE the payment to the Bill's linked Expense.
      // Every Bill created from v23.40.10 onwards has expenseId pre-populated.
      // Legacy bills may not — in that case we no-op gracefully.
      // Also write a mirror ExpensePayment so the Expense ledger view stays consistent.
      const expenseId: string | null = bill.expenseId || null;
      let mirrorExpensePaymentId: string | null = null;

      if (expenseId) {
        // Re-fetch current expense totals inside the txn
        const exp = await tx.expense.findUnique({
          where: { id: expenseId },
          select: { id: true, totalPaise: true, paidPaise: true, status: true },
        });
        if (exp) {
          const newPaid = (exp.paidPaise || 0) + amt;
          const newPayStatus =
            newPaid >= exp.totalPaise ? 'PAID' :
            newPaid > 0               ? 'PARTIALLY_PAID' :
                                        'UNPAID';
          await tx.expense.update({
            where: { id: expenseId },
            data: {
              paidPaise: newPaid,
              paymentStatus: newPayStatus,
              paidOn: newPaid > 0 ? new Date(paidOn || new Date()) : null,
            },
          });
          // Mirror ExpensePayment row so the Expense detail screen also shows the payment
          const mirror = await tx.expensePayment.create({
            data: {
              id: 'epay_' + randomBytes(10).toString('hex'),
              expenseId,
              amountPaise: amt,
              paidOn: new Date(paidOn || new Date()),
              method: method || null,
              reference: reference || null,
              notes: 'Mirror of bill payment ' + payment.id,
              receiptUrl: receiptUrl || atts[0] || null,
              attachments: atts,
              createdByUserId: session!.id,
            },
          });
          mirrorExpensePaymentId = mirror.id;

          // Back-link the BillPayment to the Expense (used by reports)
          await tx.billPayment.update({
            where: { id: payment.id },
            data: { expenseId },
          });
        }
      } else if (autoExpense) {
        // LEGACY PATH — only fires for old bills that don't yet have an expenseId.
        // Creates a fresh Expense and back-fills bill.expenseId so future payments
        // cascade correctly.
        const threshold = bill.category.approvalThresholdPaise;
        const expStatus =
          threshold === null ? 'APPROVED' :
          threshold === 0    ? 'PENDING'  :
          amt <= threshold   ? 'APPROVED' : 'PENDING';
        const exp = await tx.expense.create({
          data: {
            categoryId: bill.categoryId,
            description: bill.description,
            amountPaise: bill.amountPaise,
            gstPaise: bill.gstPaise,
            totalPaise: bill.totalPaise,
            paidPaise: amt,
            paymentStatus: amt >= bill.totalPaise ? 'PAID' : 'PARTIALLY_PAID',
            incurredOn: bill.issuedOn,
            paidOn: new Date(paidOn || new Date()),
            vendorId: bill.vendorId,
            vendorNameSnapshot: bill.vendorNameSnapshot,
            invoiceNumber: bill.billNumber,
            receiptUrl: bill.receiptUrl,
            status: expStatus as any,
            createdByUserId: session!.id,
            source: 'BILL',
            sourceRef: bill.id,
            notes: 'Auto-linked to bill (legacy backfill on first payment)',
            reviewedByUserId: session!.id,
            reviewedAt: new Date(),
            reviewNote: 'Auto-approved (bill)',
          },
        });
        await tx.bill.update({ where: { id: bill.id }, data: { expenseId: exp.id } });
        await tx.billPayment.update({ where: { id: payment.id }, data: { expenseId: exp.id } });
      }

      return { payment, expenseId, mirrorExpensePaymentId };
    });

    // Recompute bill status (outside transaction is fine — idempotent)
    await recomputeBillStatus(bill.id);

    // v23.38: audit log
    await recordAudit({
      action: 'CREATE',
      entityType: 'BillPayment',
      entityId: result.payment.id,
      after: result.payment,
      session,
      req,
    });

    return NextResponse.json({
      payment: result.payment,
      expenseId: result.expenseId,
      mirrorExpensePaymentId: result.mirrorExpensePaymentId,
    }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    console.error('[bill.payment]', err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
