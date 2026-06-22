// v23.40.15 — Branded invoice print route.
// Returns a complete standalone HTML document — bypasses ALL Next.js layouts
// (no admin sidebar, no "Finance" header). Auto-opens print dialog on load.
//
// Open in browser: /api/admin/finance/sales-invoices/[id]/print
// User then hits "Save as PDF" in the browser print dialog.

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { renderInvoiceHtml } from '@/lib/finance/render-invoice-html';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) {
    return new Response(`<h1>Forbidden</h1><p>${gate.error}</p>`, {
      status: gate.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const inv = await prisma.salesInvoice.findUnique({
    where: { id: params.id },
    include: {
      lines: true,
      payments: { orderBy: { paidOn: 'asc' } },
    },
  });
  // v23.40.17 — enrich each line with craft/artisan/badges story from Product
  if (inv) {
    const productIds = inv.lines.map(l => l.productId).filter(Boolean) as string[];
    if (productIds.length) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, craft: true, region: true, artisanName: true, story: true, craftNote: true, badges: true },
      });
      const pmap = new Map(products.map(p => [p.id, p]));
      (inv as any).lines = inv.lines.map(l => ({ ...l, product: l.productId ? pmap.get(l.productId) || null : null }));
    }
  }
  if (!inv) {
    return new Response('<h1>Invoice not found</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const url = new URL(req.url);
  const autoPrint = url.searchParams.get('auto') !== '0';
  const html = await renderInvoiceHtml(inv, {
    autoPrint,
    backHref: `/admin/finance/sales-invoices/${inv.id}`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Don't cache — invoice could be edited
      'Cache-Control': 'no-store',
    },
  });
}
