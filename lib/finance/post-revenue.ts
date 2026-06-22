// v23.40.5 — Revenue posting engine.
// Given a SalesInvoice, fan out the breakup into RevenueEntry rows:
//   - PRODUCT_REVENUE  (per line, credit)
//   - DISCOUNT         (per line, debit, only if discount > 0)
//   - GST_CGST_OUTPUT  (per line, credit) — intra-state
//   - GST_SGST_OUTPUT  (per line, credit) — intra-state
//   - GST_IGST_OUTPUT  (per line, credit) — inter-state
//   - SHIPPING_REVENUE (invoice-level, credit, only if shipping > 0)
//   - COGS             (per line if unitCostPaise set, debit)
//   - COMMISSION_INCOME (per line, only for invoiceType=COMMISSION)
//   - SELLER_PAYABLE   (per line, only for saleType=MARKETPLACE — debit since we owe seller)
//
// All entries share a deterministic sourceHash so re-posting is a no-op.

import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';
import { monthBucketOf } from './invoice-numbering';

function makeHash(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

async function isPeriodLocked(date: Date): Promise<boolean> {
  const bucket = monthBucketOf(date);
  const lock = await prisma.periodLock.findUnique({ where: { monthBucket: bucket } });
  return !!lock;
}

export async function postSalesInvoice(invoiceId: string, postedByUserId?: string): Promise<{
  posted: number; skipped: number;
}> {
  const found = await prisma.salesInvoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true },
  });
  if (!found) throw new Error('Invoice not found');
  // Narrow into a non-null const so closures below don't lose the guarantee.
  const invoice: NonNullable<typeof found> = found;

  if (invoice.paymentStatus === 'CANCELLED' || invoice.paymentStatus === 'VOID') {
    throw new Error('Cannot post a cancelled / void invoice');
  }
  if (await isPeriodLocked(invoice.issuedOn)) {
    throw new Error(`Period ${monthBucketOf(invoice.issuedOn)} is locked. Unlock before posting.`);
  }

  const txnDate = invoice.issuedOn;
  const bucket  = monthBucketOf(txnDate);
  const channel = invoice.saleChannel;
  const saleType = invoice.saleType;

  const entries: any[] = [];

  function add(args: {
    type: string;
    amountPaise: number;
    line?: any;
    cgst?: number; sgst?: number; igst?: number;
    sellerId?: string | null;
    notes?: string;
    extraHashKey?: string;
  }) {
    if (args.amountPaise === 0 && !(args.cgst || args.sgst || args.igst)) return;
    const hashParts = [
      'rev', invoice.id, args.line?.id || 'inv', args.type, args.extraHashKey || '',
    ];
    entries.push({
      id: 'rev_' + randomBytes(10).toString('hex'),
      orderId: invoice.orderId || null,
      orderItemId: null,
      invoiceId: invoice.id,
      invoiceLineId: args.line?.id || null,
      type: args.type,
      channel,
      saleType: args.line?.saleType || saleType,
      amountPaise: args.amountPaise,
      gstRatePercent: args.line?.gstRatePercent || null,
      cgstPaise: args.cgst || 0,
      sgstPaise: args.sgst || 0,
      igstPaise: args.igst || 0,
      hsnSac: args.line?.hsnSac || null,
      customerUserId: invoice.customerUserId,
      customerName: invoice.customerName,
      sellerId: args.sellerId ?? args.line?.sellerId ?? null,
      productId: args.line?.productId || null,
      variantId: args.line?.variantId || null,
      status: 'ACCRUED',
      txnDate,
      monthBucket: bucket,
      sourceHash: makeHash(hashParts),
      postedByUserId: postedByUserId || null,
      notes: args.notes || null,
    });
  }

  for (const line of invoice.lines) {
    const isCommission = invoice.invoiceType === 'COMMISSION';

    if (isCommission) {
      // Commission line → COMMISSION_INCOME credit
      add({
        type: 'COMMISSION_INCOME',
        amountPaise: line.taxableValuePaise,
        line,
      });
    } else {
      // Regular product line → PRODUCT_REVENUE credit (taxable value, post-discount)
      add({
        type: 'PRODUCT_REVENUE',
        amountPaise: line.taxableValuePaise,
        line,
      });
      // Discount: only post if explicit discount on this line
      if (line.discountPaise > 0) {
        add({
          type: 'DISCOUNT',
          amountPaise: -line.discountPaise,
          line,
          notes: 'Discount on ' + line.description,
        });
      }
      // v23.40.9 — Two-stream cost accounting:
      //   DIRECT (Neejee-owned)     → COGS debit (Neejee bore inventory cost)
      //   MARKETPLACE (seller-listed)→ SELLER_PAYABLE debit (Neejee never owned the goods;
      //                                  we owe the seller their share = unitCost × qty)
      // Posting BOTH would double-count, so the two branches are mutually exclusive.
      if (line.saleType === 'MARKETPLACE' && line.sellerId) {
        // Seller's share = unitCost × qty (set by order-poster to sellingPrice * (1 - commissionPct/100))
        // Falls back to 80% of taxable if unitCost not provided.
        const sellerShare = line.unitCostPaise
          ? Math.round((line.unitCostPaise) * line.quantity)
          : Math.round(line.taxableValuePaise * 0.80);
        add({
          type: 'SELLER_PAYABLE',
          amountPaise: -sellerShare,
          line,
          sellerId: line.sellerId,
          notes: 'Payable to seller for ' + line.description,
        });
      } else if (line.cogsPaise && line.cogsPaise > 0) {
        // Owned inventory — book COGS
        add({
          type: 'COGS',
          amountPaise: -line.cogsPaise,
          line,
        });
      }
    }

    // GST split per line (works for both regular & commission invoices)
    if (line.cgstPaise > 0) {
      add({
        type: 'GST_CGST_OUTPUT',
        amountPaise: line.cgstPaise,
        line,
        cgst: line.cgstPaise,
        extraHashKey: 'cgst',
      });
    }
    if (line.sgstPaise > 0) {
      add({
        type: 'GST_SGST_OUTPUT',
        amountPaise: line.sgstPaise,
        line,
        sgst: line.sgstPaise,
        extraHashKey: 'sgst',
      });
    }
    if (line.igstPaise > 0) {
      add({
        type: 'GST_IGST_OUTPUT',
        amountPaise: line.igstPaise,
        line,
        igst: line.igstPaise,
        extraHashKey: 'igst',
      });
    }
  }

  // Invoice-level shipping (treated as separate ledger)
  if (invoice.shippingPaise > 0) {
    add({
      type: 'SHIPPING_REVENUE',
      amountPaise: invoice.shippingPaise,
      notes: 'Shipping & handling',
      extraHashKey: 'shipping',
    });
  }
  if (invoice.shippingTaxPaise > 0) {
    // Shipping GST goes to the same output GST buckets — use IGST/CGST split heuristic
    // Treat as IGST by default for inter-state, else SGST+CGST. Use existing line-level GST as a hint:
    const hasIgst = invoice.lines.some(l => l.igstPaise > 0);
    if (hasIgst) {
      add({ type: 'GST_IGST_OUTPUT', amountPaise: invoice.shippingTaxPaise, igst: invoice.shippingTaxPaise, extraHashKey: 'ship-igst' });
    } else {
      const half = Math.floor(invoice.shippingTaxPaise / 2);
      add({ type: 'GST_CGST_OUTPUT', amountPaise: half, cgst: half, extraHashKey: 'ship-cgst' });
      add({ type: 'GST_SGST_OUTPUT', amountPaise: invoice.shippingTaxPaise - half, sgst: invoice.shippingTaxPaise - half, extraHashKey: 'ship-sgst' });
    }
  }

  // Bulk insert with skipDuplicates so re-posting is a no-op (sourceHash unique)
  const result = await prisma.revenueEntry.createMany({
    data: entries,
    skipDuplicates: true,
  });

  await prisma.salesInvoice.update({
    where: { id: invoice.id },
    data: { posted: true, postedAt: new Date() },
  });

  return { posted: result.count, skipped: entries.length - result.count };
}

// Mark all ACCRUED revenue entries on this invoice as REALIZED once payment lands.
export async function realizeInvoicePayments(invoiceId: string, paidOn: Date, paymentRef?: string | null) {
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, totalPaise: true, paidPaise: true, paymentStatus: true },
  });
  if (!invoice) return { realized: 0 };
  if (invoice.paymentStatus !== 'PAID') return { realized: 0 };

  const result = await prisma.revenueEntry.updateMany({
    where: { invoiceId, status: 'ACCRUED' },
    data: { status: 'REALIZED', realizedOn: paidOn, paymentRef: paymentRef || null },
  });
  return { realized: result.count };
}

// Reverse an invoice (refund / cancel after posting).
export async function reverseInvoice(invoiceId: string, postedByUserId?: string) {
  const original = await prisma.revenueEntry.findMany({ where: { invoiceId } });
  if (!original.length) return { reversed: 0 };
  const txnDate = new Date();
  const bucket  = monthBucketOf(txnDate);
  if (await isPeriodLocked(txnDate)) throw new Error('Current period is locked; cannot reverse.');

  const reversals = original.map(e => ({
    id: 'rev_' + randomBytes(10).toString('hex'),
    orderId: e.orderId,
    orderItemId: e.orderItemId,
    invoiceId: e.invoiceId,
    invoiceLineId: e.invoiceLineId,
    type: 'REFUND_REVERSAL',
    channel: e.channel,
    saleType: e.saleType,
    amountPaise: -e.amountPaise,
    gstRatePercent: e.gstRatePercent,
    cgstPaise: -e.cgstPaise,
    sgstPaise: -e.sgstPaise,
    igstPaise: -e.igstPaise,
    hsnSac: e.hsnSac,
    customerUserId: e.customerUserId,
    customerName: e.customerName,
    sellerId: e.sellerId,
    productId: e.productId,
    variantId: e.variantId,
    status: 'REVERSED',
    txnDate,
    monthBucket: bucket,
    sourceHash: makeHash(['rev', e.id, 'reversal']),
    postedByUserId: postedByUserId || null,
    notes: `Reversal of ${e.type} (entry ${e.id})`,
    reversedById: e.id,
  }));

  const result = await prisma.revenueEntry.createMany({ data: reversals, skipDuplicates: true });
  return { reversed: result.count };
}
