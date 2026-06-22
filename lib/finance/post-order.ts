// v23.40.9 — Order → SalesInvoice → RevenueEntry pipeline.
//
// When a website Order flips to PAID, this function creates the corresponding
// SalesInvoice (one per order, enforced by SalesInvoice.orderId unique), then
// posts the revenue ledger entries via post-revenue.ts.
//
// Two-stream handling:
//   - OWNED products       → PRODUCT_REVENUE (gross) + COGS (debit) + GST output
//   - MARKETPLACE products → PRODUCT_REVENUE (gross) + SELLER_PAYABLE (debit at
//                            line.unitCostPaise = sellingPrice × (1 − commissionPct/100))
//                            + GST output.
//                            Net Neejee income = revenue − seller payable =
//                            commission share. The full ₹100 sale is visible as
//                            gross revenue, but our actual P&L kicks in at ₹20.
//
// Idempotent: calling twice on the same orderId returns the existing invoice.

import { prisma } from '@/lib/prisma';
import { nextInvoiceNumber } from './invoice-numbering';
import { postSalesInvoice } from './post-revenue';
import { randomBytes } from 'crypto';

interface PostOrderResult {
  invoiceId:        string;
  invoiceNumber:    string;
  alreadyExisted:   boolean;
  postedEntries:    number;
  totalPaise:       number;
  saleType:         'DIRECT' | 'MARKETPLACE' | 'MIXED';
}

const FACILITATOR_STATE = process.env.NEEJEE_STATE_CODE || '27'; // default Maharashtra; override via env

/** Heuristic: any line that's marketplace-sourced makes the order mixed/marketplace. */
function classifyOrder(saleTypes: Set<'DIRECT' | 'MARKETPLACE'>): 'DIRECT' | 'MARKETPLACE' | 'MIXED' {
  if (saleTypes.size === 0) return 'DIRECT';
  if (saleTypes.size === 1) return saleTypes.values().next().value!;
  return 'MIXED';
}

export async function postOrderToInvoice(
  orderId: string,
  postedByUserId?: string | null,
): Promise<PostOrderResult> {
  // 1. Idempotency — is there already a SalesInvoice for this order?
  const existing = await prisma.salesInvoice.findUnique({ where: { orderId } });
  if (existing) {
    // Make sure it's posted (best-effort)
    let postedCount = 0;
    if (!existing.posted) {
      try {
        const r = await postSalesInvoice(existing.id, postedByUserId || undefined);
        postedCount = r.posted;
      } catch { /* ignore — may be locked period */ }
    }
    return {
      invoiceId:      existing.id,
      invoiceNumber:  existing.invoiceNumber,
      alreadyExisted: true,
      postedEntries:  postedCount,
      totalPaise:     existing.totalPaise,
      saleType:       (existing.saleType as any) || 'DIRECT',
    };
  }

  // 2. Load order with items + products + sellers (for commission %)
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true, name: true, sku: true, gstRate: true, hsnCode: true,
              ownershipModel: true, sellerId: true,
              seller: { select: { id: true, commissionPct: true, gstin: true } },
            },
          },
          variant: { select: { id: true } },
        },
      },
      address: true,
      user:    { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!order) throw new Error('Order not found');

  // 3. Determine GST split: inter-state vs intra-state.
  // We compare the order's billing state to NEEJEE_STATE_CODE.
  const buyerState = (order.address?.state || '').slice(0, 2);
  const isInterState = !!buyerState && buyerState.toUpperCase() !== FACILITATOR_STATE.toUpperCase();

  // 4. Build invoice lines
  const saleTypes = new Set<'DIRECT' | 'MARKETPLACE'>();
  let subtotal = 0, discount = 0, taxable = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;

  const builtLines = order.items.map(item => {
    const product = item.product;
    const isMarketplace = product.ownershipModel === 'MARKETPLACE';
    const saleType: 'DIRECT' | 'MARKETPLACE' = isMarketplace ? 'MARKETPLACE' : 'DIRECT';
    saleTypes.add(saleType);

    const qty           = item.quantity;
    const unitPrice     = item.price;                       // already in paise
    const lineSub       = unitPrice * qty;                  // gross before tax
    // Discount allocation: prorate Order.discount across lines by gross weight
    const lineDisc      = order.subtotal > 0
      ? Math.round(order.discount * (lineSub / order.subtotal))
      : 0;
    const taxBase       = Math.max(0, lineSub - lineDisc);
    const gstRate       = product.gstRate ?? 5;
    const totalTax      = Math.round(taxBase * gstRate / 100);

    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) {
      igst = totalTax;
    } else {
      cgst = Math.floor(totalTax / 2);
      sgst = totalTax - cgst;
    }
    const lineTotal = taxBase + totalTax;

    // v23.40.9 — KEY MARKETPLACE LOGIC:
    // For marketplace items, the seller's share = sellingPrice × (1 − commissionPct/100).
    // unitCostPaise stores this so the revenue-posting engine creates a
    // SELLER_PAYABLE (debit) of that exact amount per line. Effect:
    //   PRODUCT_REVENUE (credit) = ₹100   (gross)
    //   SELLER_PAYABLE (debit)   = −₹80  (we owe seller after our 20% commission)
    //   Net Neejee revenue       = ₹20   (our commission income)
    let unitCostPaise: number | null = null;
    let cogsPaise:     number | null = null;
    if (isMarketplace && product.seller) {
      const commissionPct = product.seller.commissionPct;
      const sellerShareUnit = Math.round(unitPrice * (100 - commissionPct) / 100);
      unitCostPaise = sellerShareUnit;
      cogsPaise     = sellerShareUnit * qty;
    } else {
      // OWNED — try to look up landing cost from PurchaseCost (most recent)
      // Done in a separate quick lookup outside this map (async issue).
      unitCostPaise = null; // placeholder, filled below
      cogsPaise     = null;
    }

    subtotal  += lineSub;
    discount  += lineDisc;
    taxable   += taxBase;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;

    return {
      id: 'invl_' + randomBytes(10).toString('hex'),
      productId: product.id,
      variantId: item.variantId || null,
      sku: product.sku || null,
      description: product.name,
      hsnSac: product.hsnCode || null,
      quantity: qty,
      unitPricePaise: unitPrice,
      discountPaise:  lineDisc,
      taxableValuePaise: taxBase,
      gstRatePercent: gstRate,
      cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst,
      totalPaise: lineTotal,
      unitCostPaise,
      cogsPaise,
      saleType,
      sellerId: isMarketplace ? product.sellerId : null,
      commissionRatePercent:     isMarketplace && product.seller ? product.seller.commissionPct : null,
      commissionBaseAmountPaise: isMarketplace ? lineSub : null,
    };
  });

  // 4b. For OWNED items, fetch most recent landing cost from PurchaseCost
  const ownedProductIds = builtLines
    .filter(l => l.saleType === 'DIRECT')
    .map(l => l.productId!)
    .filter(Boolean);
  if (ownedProductIds.length > 0) {
    const recentCosts = await prisma.purchaseCost.findMany({
      where: { productId: { in: ownedProductIds } },
      orderBy: { receivedAt: 'desc' },
      select: { productId: true, unitCostPaise: true },
    });
    // Pick the most-recent cost per product
    const costMap = new Map<string, number>();
    for (const c of recentCosts) {
      if (!costMap.has(c.productId)) costMap.set(c.productId, c.unitCostPaise);
    }
    for (const l of builtLines) {
      if (l.saleType === 'DIRECT' && l.productId && costMap.has(l.productId)) {
        l.unitCostPaise = costMap.get(l.productId)!;
        l.cogsPaise     = l.unitCostPaise * l.quantity;
      }
    }
  }

  // 5. Shipping
  const shippingPaise    = order.shipping || 0;
  const shippingTaxPaise = 0; // We treat shipping GST as already in Order.tax for now

  // 6. Totals
  const totalPaise = taxable + cgstTotal + sgstTotal + igstTotal + shippingPaise + shippingTaxPaise;

  // 7. Generate invoice number (INV/YYMM/####)
  const issuedOn      = order.createdAt;
  const invoiceNumber = await nextInvoiceNumber('INV', issuedOn);

  const orderSaleType = classifyOrder(saleTypes);
  const customerName  = order.user?.name || order.guestName || 'Walk-in customer';
  const customerEmail = order.user?.email || order.guestEmail || null;
  const customerPhone = order.user?.phone || null;

  // v23.40.11 — auto-resolve / auto-create a Customer profile so the order
  // flows into the AR customer ledger.
  const { findOrCreateCustomer } = await import('./auto-customer');
  const customerResolution = await findOrCreateCustomer({
    name: customerName,
    email: customerEmail,
    phone: customerPhone,
    gstin: order.gstinCustomer || null,
    userId: order.userId || null,
    channel: 'WEBSITE',
    customerType: order.gstinCustomer ? 'B2B' : 'INDIVIDUAL',
    source: 'AUTO_ORDER',
  });

  // 8. Create invoice with lines
  const invoice = await prisma.salesInvoice.create({
    data: {
      id: 'inv_' + randomBytes(10).toString('hex'),
      invoiceNumber,
      invoiceType: 'B2C',
      saleChannel: 'WEBSITE',
      saleType: orderSaleType === 'MIXED' ? 'DIRECT' : orderSaleType, // per-line saleType handles the mix
      customerId: customerResolution?.customerId || null,
      customerUserId: order.userId,
      customerName,
      customerEmail,
      customerPhone,
      customerGstin: order.gstinCustomer || null,
      billingAddress: order.address
        ? [order.address.line1, order.address.line2, order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(', ')
        : null,
      shippingAddress: null,
      placeOfSupply: buyerState || null,
      orderId: order.id,
      issuedOn,
      dueOn: null,
      subtotalPaise: subtotal,
      discountPaise: discount,
      taxableValuePaise: taxable,
      cgstPaise: cgstTotal,
      sgstPaise: sgstTotal,
      igstPaise: igstTotal,
      shippingPaise,
      shippingTaxPaise,
      totalPaise,
      paidPaise: order.paymentStatus === 'PAID' ? totalPaise : 0,
      paymentStatus: order.paymentStatus === 'PAID' ? 'PAID' : 'UNPAID',
      notes: `Auto-generated from website order ${order.orderNumber}.`,
      createdByUserId: postedByUserId || 'system_order_post',
      lines: { create: builtLines },
    },
  });

  // 9. If the order is already paid, record a SalesInvoicePayment too
  if (order.paymentStatus === 'PAID' && totalPaise > 0) {
    await prisma.salesInvoicePayment.create({
      data: {
        id: 'spay_' + randomBytes(10).toString('hex'),
        invoiceId: invoice.id,
        amountPaise: totalPaise,
        paidOn: order.updatedAt,
        method: order.paymentMethod || 'RAZORPAY',
        reference: order.razorpayPaymentId || null,
        notes: `Auto-recorded payment from order ${order.orderNumber}.`,
        createdByUserId: postedByUserId || 'system_order_post',
      },
    });
  }

  // 10. Post to revenue ledger
  let postedCount = 0;
  try {
    const r = await postSalesInvoice(invoice.id, postedByUserId || undefined);
    postedCount = r.posted;
  } catch (e) {
    // If posting fails (e.g. period locked), the invoice still exists for manual repost.
    console.error('[postOrderToInvoice] revenue posting failed', e);
  }

  return {
    invoiceId:      invoice.id,
    invoiceNumber:  invoice.invoiceNumber,
    alreadyExisted: false,
    postedEntries:  postedCount,
    totalPaise:     invoice.totalPaise,
    saleType:       orderSaleType,
  };
}

/** Batch backfill: process all PAID orders without an invoice. */
export async function backfillOrderInvoices(opts: {
  fromDate?: Date;
  toDate?: Date;
  dryRun?: boolean;
  byUserId?: string;
}): Promise<{
  scanned: number; created: number; skipped: number; failed: number;
  totalPaise: number; details: Array<{ orderId: string; orderNumber: string; action: string; invoiceNumber?: string; error?: string }>;
}> {
  const result = { scanned: 0, created: 0, skipped: 0, failed: 0, totalPaise: 0, details: [] as any[] };

  const where: any = { paymentStatus: 'PAID' };
  if (opts.fromDate || opts.toDate) {
    where.createdAt = {};
    if (opts.fromDate) where.createdAt.gte = opts.fromDate;
    if (opts.toDate)   where.createdAt.lte = opts.toDate;
  }

  const orders = await prisma.order.findMany({
    where,
    select: { id: true, orderNumber: true, total: true },
    orderBy: { createdAt: 'asc' },
  });
  result.scanned = orders.length;

  for (const o of orders) {
    const existing = await prisma.salesInvoice.findUnique({ where: { orderId: o.id }, select: { invoiceNumber: true } });
    if (existing) {
      result.skipped++;
      result.details.push({ orderId: o.id, orderNumber: o.orderNumber, action: 'skipped (already invoiced)', invoiceNumber: existing.invoiceNumber });
      continue;
    }
    if (opts.dryRun) {
      result.created++;
      result.totalPaise += o.total;
      result.details.push({ orderId: o.id, orderNumber: o.orderNumber, action: 'would create invoice' });
      continue;
    }
    try {
      const r = await postOrderToInvoice(o.id, opts.byUserId);
      result.created++;
      result.totalPaise += r.totalPaise;
      result.details.push({ orderId: o.id, orderNumber: o.orderNumber, action: 'created', invoiceNumber: r.invoiceNumber });
    } catch (e: any) {
      result.failed++;
      result.details.push({ orderId: o.id, orderNumber: o.orderNumber, action: 'failed', error: e?.message || String(e) });
    }
  }

  return result;
}
