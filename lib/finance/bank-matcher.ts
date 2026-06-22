// v23.39 — Auto-match engine.
// Given an UNMATCHED BankTransaction, attempts to link it to a BillPayment,
// Expense, or Order/Refund based on amount + date window + reference.

import { prisma } from '@/lib/prisma';

export interface MatchResult {
  matched: boolean;
  confidence: 'high' | 'medium' | 'low';
  kind?: 'BILL_PAYMENT' | 'EXPENSE' | 'ORDER' | 'REFUND';
  targetId?: string;
  reason: string;
}

const DATE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;  // ±3 days

/**
 * Attempt to match one bank transaction. Returns a MatchResult.
 * Does NOT update the DB; caller decides whether to commit based on confidence.
 */
export async function findMatchForTxn(txnId: string): Promise<MatchResult> {
  const txn = await prisma.bankTransaction.findUnique({ where: { id: txnId } });
  if (!txn) return { matched: false, confidence: 'low', reason: 'Transaction not found' };
  if (txn.status !== 'UNMATCHED' && txn.status !== 'DRAFT') {
    return { matched: false, confidence: 'low', reason: `Already in ${txn.status} state` };
  }

  const amount = txn.debitPaise || txn.creditPaise;
  const dateMin = new Date(txn.txnDate.getTime() - DATE_WINDOW_MS);
  const dateMax = new Date(txn.txnDate.getTime() + DATE_WINDOW_MS);

  // ── DEBITS (money out) — most likely BillPayment or Expense ──
  if (txn.debitPaise > 0) {
    // 1) High confidence: reference (UTR / cheque) matches a BillPayment
    if (txn.reference) {
      const exact = await prisma.billPayment.findFirst({
        where: { amountPaise: amount, reference: txn.reference },
      });
      if (exact) {
        return {
          matched: true, confidence: 'high',
          kind: 'BILL_PAYMENT', targetId: exact.id,
          reason: `Reference ${txn.reference} + amount ₹${(amount / 100).toFixed(2)} matched`,
        };
      }
    }

    // 2) Medium confidence: amount + date window matches a BillPayment
    const byAmount = await prisma.billPayment.findMany({
      where: {
        amountPaise: amount,
        paidOn: { gte: dateMin, lte: dateMax },
      },
    });
    if (byAmount.length === 1) {
      return {
        matched: true, confidence: 'medium',
        kind: 'BILL_PAYMENT', targetId: byAmount[0].id,
        reason: `Unique amount + date match`,
      };
    }
    if (byAmount.length > 1) {
      return {
        matched: false, confidence: 'low',
        reason: `Ambiguous — ${byAmount.length} BillPayments with same amount in date window`,
      };
    }

    // 3) Medium confidence: amount + date window matches an Expense
    const expByAmount = await prisma.expense.findMany({
      where: {
        totalPaise: amount,
        paidOn: { gte: dateMin, lte: dateMax },
      },
    });
    if (expByAmount.length === 1) {
      return {
        matched: true, confidence: 'medium',
        kind: 'EXPENSE', targetId: expByAmount[0].id,
        reason: `Unique amount + date match (expense)`,
      };
    }
  }

  // ── CREDITS (money in) — most likely Order payment or refund ──
  if (txn.creditPaise > 0) {
    // 1) Reference match on Order razorpayPaymentId
    if (txn.reference) {
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { razorpayPaymentId: txn.reference },
            { razorpayOrderId: txn.reference },
          ],
        },
      }).catch(() => null);
      if (order) {
        return {
          matched: true, confidence: 'high',
          kind: 'ORDER', targetId: order.id,
          reason: `Reference ${txn.reference} matched order`,
        };
      }
    }

    // 2) Amount + date match for orders
    const orders = await prisma.order.findMany({
      where: {
        total: amount,
        createdAt: { gte: dateMin, lte: dateMax },
        status: { not: 'CANCELLED' },
      },
    }).catch(() => []);
    if (orders.length === 1) {
      return {
        matched: true, confidence: 'medium',
        kind: 'ORDER', targetId: orders[0].id,
        reason: `Unique order amount + date match`,
      };
    }
  }

  return { matched: false, confidence: 'low', reason: 'No matching record found' };
}

/**
 * Run the matcher across all UNMATCHED transactions for an account.
 * Auto-commits HIGH confidence matches. Returns summary.
 */
export async function autoMatchAll(bankAccountId: string, opts?: {
  autoCommitMedium?: boolean;
}): Promise<{ scanned: number; autoMatched: number; suggested: number; unmatched: number }> {
  const txns = await prisma.bankTransaction.findMany({
    where: { bankAccountId, status: 'UNMATCHED' },
  });

  let autoMatched = 0;
  let suggested = 0;
  let unmatched = 0;

  for (const t of txns) {
    const result = await findMatchForTxn(t.id);
    if (result.matched && (result.confidence === 'high' || (result.confidence === 'medium' && opts?.autoCommitMedium))) {
      await prisma.bankTransaction.update({
        where: { id: t.id },
        data: {
          status: 'AUTO_MATCHED',
          matchedAt: new Date(),
          matchedBillPaymentId: result.kind === 'BILL_PAYMENT' ? result.targetId : null,
          matchedExpenseId: result.kind === 'EXPENSE' ? result.targetId : null,
          matchedRefundId: result.kind === 'ORDER' || result.kind === 'REFUND' ? result.targetId : null,
          matchNotes: result.reason,
        },
      });
      autoMatched++;
    } else if (result.matched) {
      suggested++;
      // Leave UNMATCHED for manual review
    } else {
      unmatched++;
    }
  }

  return { scanned: txns.length, autoMatched, suggested, unmatched };
}
