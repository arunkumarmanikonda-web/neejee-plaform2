// v26.4 — Customer-facing branded invoice download with self-healing fallback.
// GET /api/orders/[orderNumber]/invoice
//
// Fixes in this version:
// 1) If a persisted SalesInvoice exists but is broken (zero totals / zero lines),
//    render a corrected transient invoice directly from the Order snapshot.
// 2) Preserve secure access rules: order owner, admin/finance user, or valid token.
// 3) Keep the branded HTML output while allowing clean A4 print / save flows.

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { renderInvoiceHtml } from '@/lib/finance/render-invoice-html';
import { invoiceTokenFor } from '@/lib/finance/invoice-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FACILITATOR_STATE = (process.env.NEEJEE_STATE_CODE || '27').toUpperCase();

function cleanText(v: string | null | undefined) {
  return String(v || '').trim();
}

function addressBlock(address: any | null | undefined) {
  if (!address) return null;
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
}

function stateCodeFromAddress(address: any | null | undefined) {
  const raw = cleanText(address?.state).toUpperCase();
  if (!raw) return null;
  if (raw.length === 2) return raw;
  return raw.slice(0, 2);
}

function mapPaymentStatus(order: any, inv: any, totalPaise: number) {
  if (inv?.paymentStatus) return inv.paymentStatus;
  if (order.paymentStatus === 'PAID') return 'PAID';
  if (order.paymentStatus === 'PARTIALLY_REFUNDED') return 'PARTIALLY_PAID';
  if (order.paymentStatus === 'REFUNDED') return 'REFUNDED';
  return totalPaise > 0 ? 'UNPAID' : 'PAID';
}

function shouldUseTransient(order: any, inv: any) {
  if (!order) return false;
  if (!inv) return true;
  if ((order.total || 0) <= 0) return false;
  if (!Array.isArray(inv.lines) || inv.lines.length === 0) return true;
  if ((inv.totalPaise || 0) <= 0) return true;
  if ((inv.taxableValuePaise || 0) <= 0) return true;
  const summedLines = inv.lines.reduce((sum: number, line: any) => sum + (line.totalPaise || 0), 0);
  return summedLines <= 0;
}

function buildTransientInvoice(order: any, inv: any) {
  const buyerState = stateCodeFromAddress(order.address);
  const isInterState = !!buyerState && buyerState !== FACILITATOR_STATE;

  let subtotalPaise = 0;
  let discountPaise = 0;
  let taxableValuePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  const lines = (order.items || []).map((item: any, index: number) => {
    const product = item.product;
    const quantity = Number(item.quantity || 0) || 1;
    const unitPricePaise = Number(item.price || 0);
    const lineSub = unitPricePaise * quantity;

    const lineDiscountPaise = order.subtotal > 0
      ? Math.round((Number(order.discount || 0) * lineSub) / Number(order.subtotal || 1))
      : 0;

    const taxableLine = Math.max(0, lineSub - lineDiscountPaise);
    const gstRatePercent = Number(product?.gstRate ?? 5);
    const lineTax = Math.round((taxableLine * gstRatePercent) / 100);

    let lineCgst = 0;
    let lineSgst = 0;
    let lineIgst = 0;

    if (isInterState) {
      lineIgst = lineTax;
    } else {
      lineCgst = Math.floor(lineTax / 2);
      lineSgst = lineTax - lineCgst;
    }

    const lineTotalPaise = taxableLine + lineTax;

    subtotalPaise += lineSub;
    discountPaise += lineDiscountPaise;
    taxableValuePaise += taxableLine;
    cgstPaise += lineCgst;
    sgstPaise += lineSgst;
    igstPaise += lineIgst;

    return {
      id: inv?.lines?.[index]?.id || `transient_line_${index + 1}`,
      productId: product?.id || null,
      variantId: item.variantId || null,
      sku: product?.sku || null,
      description: product?.name || item.productNameSnapshot || `Item ${index + 1}`,
      hsnSac: product?.hsnCode || null,
      quantity,
      unitPricePaise,
      discountPaise: lineDiscountPaise,
      taxableValuePaise: taxableLine,
      gstRatePercent,
      cgstPaise: lineCgst,
      sgstPaise: lineSgst,
      igstPaise: lineIgst,
      totalPaise: lineTotalPaise,
      product: product
        ? {
            id: product.id,
            craft: product.craft,
            region: product.region,
            artisanName: product.artisanName,
            story: product.story,
            craftNote: product.craftNote,
            badges: Array.isArray(product.badges) ? product.badges : [],
          }
        : null,
    };
  });

  const shippingPaise = Number(order.shipping || 0);
  const shippingTaxPaise = inv?.shippingTaxPaise || 0;
  const computedTotal = taxableValuePaise + cgstPaise + sgstPaise + igstPaise + shippingPaise + shippingTaxPaise;
  const canonicalTotal = Number(order.total || inv?.totalPaise || computedTotal || 0);
  const roundOffPaise = canonicalTotal - computedTotal;

  const invoiceNumber = inv?.invoiceNumber || order.gstInvoice || `INV-PREVIEW-${order.orderNumber}`;
  const paidPaise = order.paymentStatus === 'PAID'
    ? canonicalTotal
    : Number(inv?.paidPaise || 0);

  return {
    id: inv?.id || `transient_${order.id}`,
    invoiceNumber,
    invoiceType: inv?.invoiceType || 'B2C',
    saleChannel: inv?.saleChannel || 'WEBSITE',
    saleType: inv?.saleType || 'DIRECT',
    customerName: order.user?.name || order.guestName || inv?.customerName || 'Customer',
    customerEmail: order.user?.email || order.guestEmail || inv?.customerEmail || null,
    customerPhone: order.user?.phone || inv?.customerPhone || null,
    customerGstin: order.gstinCustomer || inv?.customerGstin || null,
    billingAddress: addressBlock(order.address) || inv?.billingAddress || null,
    shippingAddress: addressBlock(order.address) || inv?.shippingAddress || null,
    placeOfSupply: buyerState || inv?.placeOfSupply || null,
    orderId: order.id,
    issuedOn: inv?.issuedOn || order.createdAt,
    dueOn: inv?.dueOn || null,
    subtotalPaise,
    discountPaise,
    taxableValuePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    shippingPaise,
    shippingTaxPaise,
    roundOffPaise,
    totalPaise: canonicalTotal,
    paidPaise,
    paymentStatus: mapPaymentStatus(order, inv, canonicalTotal),
    notes: inv?.notes || `Auto-generated from website order ${order.orderNumber}.`,
    lines,
    payments: Array.isArray(inv?.payments) ? inv.payments : [],
  };
}

async function enrichInvoiceLines(inv: any) {
  const productIds = (inv.lines || []).map((l: any) => l.productId).filter(Boolean) as string[];
  if (!productIds.length) return inv;

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      craft: true,
      region: true,
      artisanName: true,
      story: true,
      craftNote: true,
      badges: true,
    },
  });

  const pmap = new Map(products.map((p) => [p.id, p]));
  return {
    ...inv,
    lines: (inv.lines || []).map((l: any) => ({
      ...l,
      product: l.product || (l.productId ? pmap.get(l.productId) || null : null),
    })),
  };
}

export async function GET(req: Request, { params }: { params: { orderNumber: string } }) {
  const session = await getSession();
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              gstRate: true,
              hsnCode: true,
              craft: true,
              region: true,
              artisanName: true,
              story: true,
              craftNote: true,
              badges: true,
            },
          },
        },
      },
      address: true,
      user: {
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  }).catch(() => null);

  if (!order) {
    return new Response('<h1>Order not found</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const isOwner = !!(session?.id && order.userId && session.id === order.userId);
  const isAdmin = !!(session?.role && ['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(session.role));
  const hasValidToken = !!(token && token === invoiceTokenFor(order.id));

  if (!isOwner && !isAdmin && !hasValidToken) {
    return new Response(
      '<h1>Sign in required</h1><p>Please sign in to access your invoice, or use the link from your order confirmation email.</p>',
      {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }

  let inv = await prisma.salesInvoice.findUnique({
    where: { orderId: order.id },
    include: {
      lines: true,
      payments: { orderBy: { paidOn: 'asc' } },
    },
  });

  if (!inv) {
    try {
      const { postOrderToInvoice } = await import('@/lib/finance/post-order');
      await postOrderToInvoice(order.id);
      inv = await prisma.salesInvoice.findUnique({
        where: { orderId: order.id },
        include: {
          lines: true,
          payments: { orderBy: { paidOn: 'asc' } },
        },
      });
    } catch (e: any) {
      console.warn('[customer invoice] lazy post failed:', e?.message);
    }
  }

  const invoiceForRender = shouldUseTransient(order, inv)
    ? buildTransientInvoice(order, inv)
    : await enrichInvoiceLines(inv);

  const autoPrint = url.searchParams.get('auto') !== '0';
  const html = await renderInvoiceHtml(invoiceForRender, {
    autoPrint,
    backHref: '/account?tab=orders',
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
