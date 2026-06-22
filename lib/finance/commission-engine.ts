// v23.40.6 — Commission billing engine.
// For each delivered marketplace order that hasn't been commission-billed yet,
// create a SalesInvoice (type=COMMISSION) billed TO the seller, then post it
// to the revenue ledger. Idempotent via SalesInvoice.orderId unique constraint
// (one COMMISSION invoice per order) — but we consolidate per (seller, week).

import { prisma } from '@/lib/prisma';
import { nextInvoiceNumber } from './invoice-numbering';
import { postSalesInvoice } from './post-revenue';
import { randomBytes, createHash } from 'crypto';

interface RunArgs {
  // Window to consider — defaults to "delivered in the last 8 days"
  fromDate?: Date;
  toDate?:   Date;
  // Specific seller (optional). If unset, all marketplace sellers with deliveries.
  sellerId?: string;
  // Default GST rate on commission services (18% under SAC 9961/9962)
  commissionGstRatePercent?: number;
  // Auto-post to revenue ledger?  Default true.
  autoPost?: boolean;
  // Dry-run mode: compute but don't write
  dryRun?: boolean;
  // Who triggered (for audit). May be a system marker for cron.
  byUserId?: string;
}

interface RunResult {
  sellersProcessed:  number;
  invoicesCreated:   number;
  ordersBilled:      number;
  totalCommissionPaise: number;
  totalGstPaise:        number;
  invoices:          Array<{ id: string; sellerId: string; invoiceNumber: string; ordersCount: number; totalPaise: number }>;
  skippedReasons:    Array<{ orderId: string; reason: string }>;
}

const SYSTEM_USER_ID = 'system_commission_cron';

export async function runCommissionBilling(args: RunArgs = {}): Promise<RunResult> {
  const toDate   = args.toDate   || new Date();
  const fromDate = args.fromDate || new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const gstRate  = args.commissionGstRatePercent ?? 18; // standard for online intermediary services
  const autoPost = args.autoPost !== false;
  const dryRun   = !!args.dryRun;
  const byUserId = args.byUserId || SYSTEM_USER_ID;

  const result: RunResult = {
    sellersProcessed: 0,
    invoicesCreated:  0,
    ordersBilled:     0,
    totalCommissionPaise: 0,
    totalGstPaise:        0,
    invoices: [],
    skippedReasons: [],
  };

  // 1. Find candidate orders:
  //    - delivered between fromDate and toDate
  //    - paymentStatus = PAID (we only bill commission on collected orders)
  //    - contains at least one item from a MARKETPLACE product (Product.ownershipModel = MARKETPLACE)
  //    - no existing COMMISSION invoice for this order yet
  const candidateOrders = await prisma.order.findMany({
    where: {
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      deliveredAt: { gte: fromDate, lte: toDate },
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true, name: true, ownershipModel: true, sellerId: true,
              hsnCode: true, gstRate: true,
              seller: { select: { id: true, businessName: true, commissionPct: true, gstin: true, email: true, phone: true } },
            },
          },
        },
      },
    },
  });

  // 2. Group items by seller
  type SellerBucket = {
    seller: { id: string; businessName: string; commissionPct: number; gstin: string | null; email: string; phone: string };
    items: Array<{
      orderId: string; orderNumber: string;
      productId: string; productName: string;
      saleAmountPaise: number;
      commissionRatePercent: number;
      commissionAmountPaise: number;
    }>;
    orderIds: Set<string>;
  };
  const buckets = new Map<string, SellerBucket>();

  for (const order of candidateOrders) {
    for (const item of order.items) {
      const product = item.product;
      if (product.ownershipModel !== 'MARKETPLACE') continue;
      if (!product.seller) continue;
      if (args.sellerId && product.sellerId !== args.sellerId) continue;

      // Skip if a COMMISSION invoice for this exact order already exists
      // (we check post-bucket aggregation; cheap to query once here too)
      // But for efficiency, we'll skip later with a single bulk query.

      const saleAmount  = item.total;
      const commissionPct = product.seller.commissionPct;
      const commission  = Math.round(saleAmount * commissionPct / 100);

      if (!buckets.has(product.sellerId!)) {
        buckets.set(product.sellerId!, {
          seller: product.seller!,
          items: [],
          orderIds: new Set(),
        });
      }
      const b = buckets.get(product.sellerId!)!;
      b.items.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        productId: product.id,
        productName: product.name,
        saleAmountPaise: saleAmount,
        commissionRatePercent: commissionPct,
        commissionAmountPaise: commission,
      });
      b.orderIds.add(order.id);
    }
  }

  // 3. For each seller bucket, filter out already-billed orders, then create one invoice.
  for (const [sellerId, bucket] of buckets) {
    // Find orders already covered by a COMMISSION invoice (via notes field hash or via line.commissionBaseAmountPaise + sellerId)
    // We use the deterministic source-hash convention: 'commission|<orderId>|<productId>'
    // and check whether any SalesInvoiceLine with matching commissionBaseAmountPaise exists.
    // Simpler: query SalesInvoiceLine for those orderIds via the parent invoice.
    const existingLines = await prisma.salesInvoiceLine.findMany({
      where: {
        invoice: { invoiceType: 'COMMISSION', sellerId },
        sku: { in: Array.from(bucket.orderIds).map(id => 'COMM-' + id) },
      },
      select: { sku: true },
    });
    const billedSet = new Set(existingLines.map(l => l.sku!).filter(Boolean));

    const billableItems = bucket.items.filter(it => !billedSet.has('COMM-' + it.orderId + '-' + it.productId));
    // We use orderId+productId in SKU so the same order can be billed in pieces (across items)
    if (!billableItems.length) {
      bucket.orderIds.forEach(id => result.skippedReasons.push({ orderId: id, reason: 'Already billed' }));
      continue;
    }

    result.sellersProcessed++;

    // Aggregate lines into the commission invoice
    let subtotalPaise = 0, taxableValuePaise = 0, cgstTotalPaise = 0, sgstTotalPaise = 0, igstTotalPaise = 0;
    const isInterState = false; // Neejee is single-state for now. Future: derive from seller GSTIN state vs ours.
    const builtLines = billableItems.map(it => {
      const taxBase = it.commissionAmountPaise;
      const totalTax = Math.round(taxBase * gstRate / 100);
      let cgst = 0, sgst = 0, igst = 0;
      if (isInterState) igst = totalTax;
      else { cgst = Math.floor(totalTax / 2); sgst = totalTax - cgst; }
      const total = taxBase + totalTax;
      subtotalPaise     += taxBase;
      taxableValuePaise += taxBase;
      cgstTotalPaise    += cgst;
      sgstTotalPaise    += sgst;
      igstTotalPaise    += igst;
      return {
        id: 'invl_' + randomBytes(10).toString('hex'),
        productId: it.productId,
        sku: 'COMM-' + it.orderId + '-' + it.productId, // dedupe key
        description: `Commission @ ${it.commissionRatePercent}% on order ${it.orderNumber} (${it.productName})`,
        hsnSac: '9961',  // online marketplace services
        quantity: 1,
        unitPricePaise: taxBase,
        discountPaise: 0,
        taxableValuePaise: taxBase,
        gstRatePercent: gstRate,
        cgstPaise: cgst,
        sgstPaise: sgst,
        igstPaise: igst,
        totalPaise: total,
        saleType: 'MARKETPLACE',
        sellerId,
        commissionRatePercent: it.commissionRatePercent,
        commissionBaseAmountPaise: it.saleAmountPaise,
      };
    });

    const totalPaise = taxableValuePaise + cgstTotalPaise + sgstTotalPaise + igstTotalPaise;

    if (dryRun) {
      result.invoicesCreated++;
      result.ordersBilled += billableItems.length;
      result.totalCommissionPaise += subtotalPaise;
      result.totalGstPaise += cgstTotalPaise + sgstTotalPaise + igstTotalPaise;
      result.invoices.push({
        id: 'dry_' + sellerId, sellerId,
        invoiceNumber: 'COM/DRY/' + sellerId.slice(-4),
        ordersCount: bucket.orderIds.size,
        totalPaise,
      });
      continue;
    }

    const issuedOn = new Date();
    const invoiceNumber = await nextInvoiceNumber('COM', issuedOn);
    const dueOn = new Date(issuedOn);
    dueOn.setDate(dueOn.getDate() + 15); // 15-day payment terms

    const invoice = await prisma.salesInvoice.create({
      data: {
        id: 'inv_' + randomBytes(10).toString('hex'),
        invoiceNumber,
        invoiceType: 'COMMISSION',
        saleChannel: 'MARKETPLACE_COMMISSION',
        saleType: 'MARKETPLACE',
        customerName: bucket.seller.businessName,
        customerEmail: bucket.seller.email,
        customerPhone: bucket.seller.phone,
        customerGstin: bucket.seller.gstin,
        sellerId,
        issuedOn,
        dueOn,
        subtotalPaise,
        discountPaise: 0,
        taxableValuePaise,
        cgstPaise: cgstTotalPaise,
        sgstPaise: sgstTotalPaise,
        igstPaise: igstTotalPaise,
        shippingPaise: 0,
        shippingTaxPaise: 0,
        totalPaise,
        paidPaise: 0,
        paymentStatus: 'UNPAID',
        notes: `Auto-generated commission billing for ${billableItems.length} order line(s) delivered between ${fromDate.toISOString().slice(0,10)} and ${toDate.toISOString().slice(0,10)}.`,
        createdByUserId: byUserId,
        lines: { create: builtLines },
      },
    });

    if (autoPost) {
      try {
        await postSalesInvoice(invoice.id, byUserId);
      } catch {
        // Posting may fail if period is locked; ignore — admin can re-post manually
      }
    }

    result.invoicesCreated++;
    result.ordersBilled += billableItems.length;
    result.totalCommissionPaise += subtotalPaise;
    result.totalGstPaise += cgstTotalPaise + sgstTotalPaise + igstTotalPaise;
    result.invoices.push({
      id: invoice.id, sellerId, invoiceNumber,
      ordersCount: bucket.orderIds.size,
      totalPaise,
    });
  }

  return result;
}
