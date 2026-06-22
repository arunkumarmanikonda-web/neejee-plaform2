// v23.40.12 — Order refund / return reversal hooks.
//
// When an order is refunded or items returned, this service:
//   1. Reverses the SalesInvoice's RevenueEntries (full or partial)
//   2. Posts a SalesInvoicePayment with NEGATIVE amount (refund leg) so the
//      customer ledger shows the credit back
//   3. Reduces SalesInvoice.paidPaise and adjusts paymentStatus to REFUNDED
//   4. For marketplace lines: also reverses SELLER_PAYABLE so we don't keep
//      owing the seller for items we refunded the buyer
//   5. For Neejee-owned (DIRECT) lines: posts a COGS write-back if items were
//      restocked (rather than damaged)
//
// Idempotent via SalesInvoice.paymentStatus flag + ReturnEntry.id in sourceHash.
//
// Trigger points:
//   - Admin orders PATCH → status REFUNDED (full refund)
//   - Admin returns POST → records a ReturnEntry (partial or full return)

import { prisma } from '@/lib/prisma';
import { randomBytes, createHash } from 'crypto';

function makeHash(parts: (string | number | null | undefined)[]): string {
  return createHash('sha256').update(parts.map(p => String(p ?? '')).join('|')).digest('hex').slice(0, 32);
}
function monthBucketOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface ReverseOrderInput {
  orderId: string;
  // Total amount being refunded TO the customer (paise). Used for the negative payment leg.
  refundAmountPaise: number;
  // Optional: amount of refund that came from restocked goods (COGS write-back, paise).
  restockedValuePaise?: number;
  // Optional: amount written off as damaged (no COGS write-back; loss stays in P&L).
  damagedValuePaise?: number;
  // Optional: ratio of the original invoice that this refund represents (0..1).
  // If 1 (default for full refund), every original RevenueEntry is reversed in full.
  // If <1 (partial return), proportional reversals are posted.
  proportionReversed?: number;
  refundedOn?: Date;
  reason?: string;
  notes?: string;
  postedByUserId?: string;
  returnEntryId?: string;       // ties revenue reversal back to the ReturnEntry
  paymentRef?: string | null;
  method?: string | null;
}

export interface ReverseOrderResult {
  reversed: boolean;
  invoiceId: string | null;
  revenueEntriesReversed: number;
  refundPaymentId: string | null;
  cogsWriteBackPaise: number;
  reason?: string;
}

export async function reverseOrderRevenue(input: ReverseOrderInput): Promise<ReverseOrderResult> {
  const {
    orderId, refundAmountPaise,
    restockedValuePaise = 0, damagedValuePaise = 0,
    proportionReversed = 1,
    refundedOn, reason, notes, postedByUserId,
    returnEntryId, paymentRef, method,
  } = input;

  if (!orderId) throw new Error('orderId required');
  if (refundAmountPaise <= 0) throw new Error('refundAmountPaise must be > 0');

  // 1. Find the SalesInvoice linked to this order
  const invoice = await prisma.salesInvoice.findUnique({
    where: { orderId },
    include: { lines: true },
  });
  if (!invoice) {
    // No invoice posted yet — nothing to reverse. Caller should handle.
    return { reversed: false, invoiceId: null, revenueEntriesReversed: 0, refundPaymentId: null, cogsWriteBackPaise: 0, reason: 'no-invoice-for-order' };
  }

  // 2. Already fully refunded? bail out idempotently
  if (invoice.paymentStatus === 'REFUNDED' || invoice.paymentStatus === 'VOID') {
    return { reversed: false, invoiceId: invoice.id, revenueEntriesReversed: 0, refundPaymentId: null, cogsWriteBackPaise: 0, reason: 'already-reversed' };
  }

  const reversalDate = refundedOn || new Date();
  const monthBucket = monthBucketOf(reversalDate);

  // 3. Check period lock
  const lock = await prisma.periodLock.findUnique({ where: { monthBucket } });
  if (lock) throw new Error(`Period ${monthBucket} is locked; cannot post reversal.`);

  // 4. Pull original RevenueEntries for this invoice
  const original = await prisma.revenueEntry.findMany({
    where: { invoiceId: invoice.id, status: { in: ['ACCRUED', 'REALIZED'] } },
  });

  // 5. Build reversal entries — negative mirrors, proportional if partial return
  const ratio = Math.max(0, Math.min(1, proportionReversed));
  const reversalRows = original.map(e => {
    // Skip if it's already a reversal entry itself
    if (e.type === 'REFUND_REVERSAL') return null;
    const scale = (n: number) => Math.round(n * ratio);
    return {
      id: 'rev_' + randomBytes(10).toString('hex'),
      orderId: e.orderId,
      orderItemId: e.orderItemId,
      invoiceId: e.invoiceId,
      invoiceLineId: e.invoiceLineId,
      type: 'REFUND_REVERSAL' as const,
      channel: e.channel,
      saleType: e.saleType,
      amountPaise: -scale(e.amountPaise),
      gstRatePercent: e.gstRatePercent,
      cgstPaise: -scale(e.cgstPaise),
      sgstPaise: -scale(e.sgstPaise),
      igstPaise: -scale(e.igstPaise),
      hsnSac: e.hsnSac,
      customerUserId: e.customerUserId,
      customerName: e.customerName,
      sellerId: e.sellerId,
      productId: e.productId,
      variantId: e.variantId,
      status: 'REVERSED' as const,
      txnDate: reversalDate,
      monthBucket,
      sourceHash: makeHash(['rev', e.id, returnEntryId || 'full-refund', ratio]),
      postedByUserId: postedByUserId || null,
      notes: `Reversal of ${e.type}${reason ? ` (${reason})` : ''}`,
      reversedById: e.id,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  // 6. COGS write-back if restocked
  let cogsWriteBackPaise = 0;
  if (restockedValuePaise > 0) {
    reversalRows.push({
      id: 'rev_' + randomBytes(10).toString('hex'),
      orderId,
      orderItemId: null as any,
      invoiceId: invoice.id,
      invoiceLineId: null as any,
      type: 'COGS_WRITE_BACK' as any,
      channel: invoice.saleChannel as any,
      saleType: invoice.saleType as any,
      amountPaise: -restockedValuePaise, // negative COGS = profit add-back
      gstRatePercent: null as any,
      cgstPaise: 0, sgstPaise: 0, igstPaise: 0,
      hsnSac: null as any,
      customerUserId: invoice.customerUserId,
      customerName: invoice.customerName,
      sellerId: null as any,
      productId: null as any,
      variantId: null as any,
      status: 'REVERSED' as const,
      txnDate: reversalDate,
      monthBucket,
      sourceHash: makeHash(['cogs-writeback', invoice.id, returnEntryId || 'full', restockedValuePaise]),
      postedByUserId: postedByUserId || null,
      notes: `COGS write-back from restocked goods${reason ? ` (${reason})` : ''}`,
      reversedById: null as any,
    });
    cogsWriteBackPaise = restockedValuePaise;
  }

  // 7. Run the reversal + refund payment + invoice update in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Post negative RevenueEntries (idempotent via sourceHash unique constraint)
    const created = await tx.revenueEntry.createMany({ data: reversalRows as any, skipDuplicates: true });

    // Post negative SalesInvoicePayment so the customer ledger reflects the refund
    const refundPayment = await tx.salesInvoicePayment.create({
      data: {
        id: 'sipay_' + randomBytes(10).toString('hex'),
        invoiceId: invoice.id,
        amountPaise: -Math.abs(refundAmountPaise),   // negative = refund out
        paidOn: reversalDate,
        method: method || 'REFUND',
        reference: paymentRef || returnEntryId || null,
        notes: `Refund${reason ? `: ${reason}` : ''}${notes ? ` — ${notes}` : ''}`,
        // SalesInvoicePayment.createdByUserId is required — fall back to the
        // synthetic system user when no operator is in context (e.g. webhook).
        createdByUserId: postedByUserId || 'system',
      },
    });

    // Adjust invoice totals + paymentStatus
    const newPaid = invoice.paidPaise - Math.abs(refundAmountPaise);
    const isFullRefund = ratio >= 0.999 || Math.abs(refundAmountPaise) >= invoice.totalPaise;
    const newPaymentStatus =
      isFullRefund            ? 'REFUNDED' :
      newPaid <= 0            ? 'REFUNDED' :
      newPaid < invoice.totalPaise ? 'PARTIALLY_REFUNDED' :
                                'PAID';

    await tx.salesInvoice.update({
      where: { id: invoice.id },
      data: {
        paidPaise: newPaid,
        paymentStatus: newPaymentStatus,
      },
    });

    return { revenueEntriesReversed: created.count, refundPaymentId: refundPayment.id };
  });

  return {
    reversed: true,
    invoiceId: invoice.id,
    revenueEntriesReversed: result.revenueEntriesReversed,
    refundPaymentId: result.refundPaymentId,
    cogsWriteBackPaise,
  };
}
