// v23.40.5 — Sales Invoice CRUD
// GET  /api/admin/finance/sales-invoices       — list (filter by type/seller/customer/status/from/to)
// POST /api/admin/finance/sales-invoices       — create + auto-post to revenue ledger

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { nextInvoiceNumber } from '@/lib/finance/invoice-numbering';
import { postSalesInvoice } from '@/lib/finance/post-revenue';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const where: any = {};
  if (url.searchParams.get('invoiceType')) where.invoiceType = url.searchParams.get('invoiceType');
  if (url.searchParams.get('sellerId'))    where.sellerId    = url.searchParams.get('sellerId');
  if (url.searchParams.get('customerUserId')) where.customerUserId = url.searchParams.get('customerUserId');
  if (url.searchParams.get('paymentStatus')) where.paymentStatus  = url.searchParams.get('paymentStatus');
  const from = url.searchParams.get('from');
  const to   = url.searchParams.get('to');
  if (from || to) {
    where.issuedOn = {};
    if (from) where.issuedOn.gte = new Date(from);
    if (to)   { const d = new Date(to); d.setHours(23,59,59,999); where.issuedOn.lte = d; }
  }
  const q = url.searchParams.get('q')?.trim();
  if (q) {
    where.OR = [
      { invoiceNumber:  { contains: q, mode: 'insensitive' as const } },
      { customerName:   { contains: q, mode: 'insensitive' as const } },
      { customerEmail:  { contains: q, mode: 'insensitive' as const } },
      { customerPhone:  { contains: q, mode: 'insensitive' as const } },
      { customerGstin:  { contains: q, mode: 'insensitive' as const } },
    ];
  }

  const invoices = await prisma.salesInvoice.findMany({
    where,
    orderBy: { issuedOn: 'desc' },
    take: 200,
    include: {
      lines:   { select: { id: true, description: true, quantity: true, totalPaise: true } },
      payments:{ select: { id: true, amountPaise: true, paidOn: true } },
    },
  });
  return NextResponse.json({ invoices });
}

interface LineInput {
  productId?: string | null;
  variantId?: string | null;
  sku?: string | null;
  description: string;
  hsnSac?: string | null;
  quantity: number;
  unitPriceRupees: number;
  discountRupees?: number;
  gstRatePercent?: number;
  unitCostRupees?: number;          // landing cost
  saleType?: 'DIRECT' | 'MARKETPLACE';
  sellerId?: string | null;
  commissionRatePercent?: number;   // only for COMMISSION invoices
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const {
      invoiceType = 'POS',
      saleChannel,
      saleType = 'DIRECT',
      customerId: customerIdInput = null,   // v23.40.11 — link to Customer profile
      customerName,
      customerEmail = null,
      customerPhone = null,
      customerGstin = null,
      customerUserId = null,
      billingAddress = null,
      shippingAddress = null,
      placeOfSupply = null,           // state code (e.g. '27' for Maharashtra)
      isInterState = false,           // controls CGST/SGST vs IGST
      sellerId = null,
      orderId = null,
      issuedOn,
      dueOn = null,
      lines = [] as LineInput[],
      shippingRupees = 0,
      shippingGstRatePercent = 0,
      attachments = [],
      notes = null,
      autoPost = true,                // post to revenue ledger immediately
    } = body;

    if (!customerName) return NextResponse.json({ error: 'customerName is required' }, { status: 400 });
    if (!saleChannel)  return NextResponse.json({ error: 'saleChannel is required' }, { status: 400 });
    if (!lines.length) return NextResponse.json({ error: 'at least one line is required' }, { status: 400 });

    const prefixMap: Record<string, 'INV' | 'COM' | 'POS' | 'BLK'> = {
      B2C: 'INV', B2B: 'INV', POS: 'POS', BULK: 'BLK', COMMISSION: 'COM',
    };
    const prefix = prefixMap[invoiceType] || 'INV';
    const issuedDate = issuedOn ? new Date(issuedOn) : new Date();
    const invoiceNumber = await nextInvoiceNumber(prefix, issuedDate);

    // Compute line totals
    let subtotal = 0, discount = 0, taxable = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    const builtLines = (lines as LineInput[]).map((l: LineInput) => {
      const qty   = Number(l.quantity || 0);
      const unit  = Math.round((Number(l.unitPriceRupees) || 0) * 100);
      const disc  = Math.round((Number(l.discountRupees) || 0) * 100);
      const rate  = Number(l.gstRatePercent || 0);
      const taxBase = Math.max(0, (qty * unit) - disc);
      const totalTax = Math.round(taxBase * rate / 100);
      let cgst = 0, sgst = 0, igst = 0;
      if (isInterState) {
        igst = totalTax;
      } else {
        cgst = Math.floor(totalTax / 2);
        sgst = totalTax - cgst;
      }
      const total = taxBase + totalTax;
      const unitCost = l.unitCostRupees != null ? Math.round(Number(l.unitCostRupees) * 100) : null;
      const cogs = unitCost != null ? Math.round(unitCost * qty) : null;
      subtotal  += qty * unit;
      discount  += disc;
      taxable   += taxBase;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;
      return {
        id: 'invl_' + randomBytes(10).toString('hex'),
        productId: l.productId || null,
        variantId: l.variantId || null,
        sku: l.sku || null,
        description: l.description,
        hsnSac: l.hsnSac || null,
        quantity: qty,
        unitPricePaise: unit,
        discountPaise: disc,
        taxableValuePaise: taxBase,
        gstRatePercent: rate,
        cgstPaise: cgst,
        sgstPaise: sgst,
        igstPaise: igst,
        totalPaise: total,
        unitCostPaise: unitCost,
        cogsPaise: cogs,
        saleType: l.saleType || saleType,
        sellerId: l.sellerId || (l.saleType === 'MARKETPLACE' ? sellerId : null),
        commissionRatePercent: l.commissionRatePercent || null,
        commissionBaseAmountPaise: l.commissionRatePercent
          ? Math.round(taxBase / (l.commissionRatePercent / 100))
          : null,
      };
    });

    const shippingPaise    = Math.round((Number(shippingRupees) || 0) * 100);
    const shippingTaxPaise = Math.round(shippingPaise * (Number(shippingGstRatePercent) || 0) / 100);
    const totalPaise       = taxable + cgstTotal + sgstTotal + igstTotal + shippingPaise + shippingTaxPaise;

    // v23.40.11 — resolve or auto-create a Customer profile so every invoice lands
    // in a customer ledger. Same pattern as findOrCreateVendor for the AR side.
    const { findOrCreateCustomer } = await import('@/lib/finance/auto-customer');
    const customerResolution = await findOrCreateCustomer({
      customerId: customerIdInput,
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      gstin: customerGstin,
      userId: customerUserId,
      channel: saleChannel === 'POS' ? 'POS' : (saleChannel === 'BULK' ? 'BULK' : 'WEBSITE'),
      customerType: customerGstin ? 'B2B' : (invoiceType === 'BULK' ? 'WHOLESALE' : 'INDIVIDUAL'),
      source: invoiceType === 'POS' ? 'AUTO_POS' : 'MANUAL',
      createdByUserId: session!.id,
    });
    const finalCustomerId = customerResolution?.customerId || null;

    const invoice = await prisma.salesInvoice.create({
      data: {
        id: 'inv_' + randomBytes(10).toString('hex'),
        invoiceNumber,
        invoiceType,
        saleChannel,
        saleType,
        customerId: finalCustomerId,
        customerUserId,
        customerName,
        customerEmail,
        customerPhone,
        customerGstin,
        billingAddress,
        shippingAddress,
        sellerId,
        orderId,
        issuedOn: issuedDate,
        dueOn: dueOn ? new Date(dueOn) : null,
        placeOfSupply,
        subtotalPaise: subtotal,
        discountPaise: discount,
        taxableValuePaise: taxable,
        cgstPaise: cgstTotal,
        sgstPaise: sgstTotal,
        igstPaise: igstTotal,
        shippingPaise,
        shippingTaxPaise,
        totalPaise,
        paidPaise: 0,
        paymentStatus: 'UNPAID',
        attachments: Array.isArray(attachments) ? attachments.filter(Boolean) : [],
        notes,
        createdByUserId: session!.id,
        lines: { create: builtLines },
      },
      include: { lines: true },
    });

    let posted = { posted: 0, skipped: 0 };
    if (autoPost) {
      try {
        posted = await postSalesInvoice(invoice.id, session!.id);
      } catch (e: any) {
        // Posting failed but invoice persisted — return both
        return NextResponse.json({ invoice, postError: e.message, posted }, { status: 201 });
      }
    }

    await recordAudit({
      action: 'CREATE',
      entityType: 'SalesInvoice',
      entityId: invoice.id,
      after: invoice,
      session,
      req,
    });

    return NextResponse.json({ invoice, posted }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to create invoice' }, { status: 500 });
  }
}
