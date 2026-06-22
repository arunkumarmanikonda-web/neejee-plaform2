// v23.40.18 — Customer-facing branded invoice download.
// GET /api/orders/[orderNumber]/invoice
//
// Returns the same branded HTML invoice used by admin, but with the customer
// (not finance) as the audience. Auth: the requester must either:
//   - be signed in as the order's user, OR
//   - hit the URL with ?token=<orderToken> matching the order (used in emails)
//
// Server renders the FULL invoice (same renderer) and triggers print on load
// so "Save as PDF" downloads it.

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { renderInvoiceHtml } from '@/lib/finance/render-invoice-html';
import { invoiceTokenFor } from '@/lib/finance/invoice-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { orderNumber: string } }) {
  const session = await getSession();
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';

  // Look up the order (so we know who owns it)
  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    select: { id: true, userId: true, guestEmail: true },
  }).catch(() => null);

  if (!order) {
    return new Response('<h1>Order not found</h1>', { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  // Authorize: signed-in owner OR matching token
  const isOwner = !!(session?.id && order.userId && session.id === order.userId);
  const isAdmin = !!(session?.role && ['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(session.role));
  const hasValidToken = !!(token && token === invoiceTokenFor(order.id));

  if (!isOwner && !isAdmin && !hasValidToken) {
    return new Response(
      '<h1>Sign in required</h1><p>Please sign in to access your invoice, or use the link from your order confirmation email.</p>',
      { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  // Find the SalesInvoice for this order
  let inv = await prisma.salesInvoice.findUnique({
    where: { orderId: order.id },
    include: { lines: true, payments: { orderBy: { paidOn: 'asc' } } },
  });

  // If invoice doesn't exist yet (e.g. customer hits link before our hooks fire),
  // post it lazily then re-fetch
  if (!inv) {
    try {
      const { postOrderToInvoice } = await import('@/lib/finance/post-order');
      await postOrderToInvoice(order.id);
      inv = await prisma.salesInvoice.findUnique({
        where: { orderId: order.id },
        include: { lines: true, payments: { orderBy: { paidOn: 'asc' } } },
      });
    } catch (e: any) {
      console.warn('[customer invoice] lazy post failed:', e?.message);
    }
  }

  if (!inv) {
    return new Response(
      '<h1>Invoice not ready</h1><p>Your invoice is still being prepared. Please refresh in a minute, or check your order confirmation email.</p>',
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  // Enrich lines with product craft story (same as admin route)
  const productIds = inv.lines.map(l => l.productId).filter(Boolean) as string[];
  if (productIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, craft: true, region: true, artisanName: true, story: true, craftNote: true, badges: true },
    });
    const pmap = new Map(products.map(p => [p.id, p]));
    (inv as any).lines = inv.lines.map(l => ({ ...l, product: l.productId ? pmap.get(l.productId) || null : null }));
  }

  const autoPrint = url.searchParams.get('auto') !== '0';
  const html = await renderInvoiceHtml(inv, {
    autoPrint,
    // Customer goes back to their account, not the admin invoice list
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
