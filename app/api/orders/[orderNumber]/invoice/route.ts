import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { renderInvoiceHtml } from '@/lib/finance/render-invoice-html';
import { InvoiceStateReviewError } from '@/lib/finance/gst-state';
import { invoiceTokenFor } from '@/lib/finance/invoice-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function invoiceNeedsReview(order: any, inv: any) {
  if ((order.total || 0) <= 0) return false;
  if (!Array.isArray(inv.lines) || inv.lines.length === 0) return true;
  if ((inv.totalPaise || 0) <= 0) return true;
  if ((inv.taxableValuePaise || 0) <= 0) return true;
  const summedLines = inv.lines.reduce((sum: number, line: any) => sum + (line.totalPaise || 0), 0);
  return summedLines <= 0;
}

function invoiceUnavailable(status: 409 | 503) {
  const message = status === 409
    ? 'Your invoice details need review. Please contact Neejee with your order number.'
    : 'Your invoice is temporarily unavailable. Please try again later.';
  return new Response(`<h1>Invoice unavailable</h1><p>${message}</p>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
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
    select: { id: true, userId: true, total: true, gstInvoice: true },
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
    if (order.gstInvoice) return invoiceUnavailable(409);
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
      return invoiceUnavailable(e instanceof InvoiceStateReviewError ? 409 : 503);
    }
  }

  if (!inv) return invoiceUnavailable(503);
  if (invoiceNeedsReview(order, inv)) return invoiceUnavailable(409);
  const invoiceForRender = await enrichInvoiceLines(inv);

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
