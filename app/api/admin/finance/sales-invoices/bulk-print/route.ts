// v23.40.15 — Bulk branded invoice print route.
// /api/admin/finance/sales-invoices/bulk-print?ids=id1,id2,id3
// Returns multiple invoices stacked with page-breaks as one standalone HTML doc.

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { renderBulkInvoicesHtml } from '@/lib/finance/render-invoice-html';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) {
    return new Response(`<h1>Forbidden</h1><p>${gate.error}</p>`, {
      status: gate.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const url = new URL(req.url);
  const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
  if (!ids.length) {
    return new Response('<h1>No invoice ids provided</h1>', {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const invoices = await prisma.salesInvoice.findMany({
    where: { id: { in: ids } },
    include: { lines: true, payments: { orderBy: { paidOn: 'asc' } } },
    orderBy: { invoiceNumber: 'asc' },
  });
  // v23.40.17 — enrich lines with product craft/artisan story
  const allProductIds = invoices.flatMap(i => i.lines.map(l => l.productId).filter(Boolean) as string[]);
  if (allProductIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: allProductIds } },
      select: { id: true, craft: true, region: true, artisanName: true, story: true, craftNote: true, badges: true },
    });
    const pmap = new Map(products.map(p => [p.id, p]));
    for (const inv of invoices) {
      (inv as any).lines = inv.lines.map(l => ({ ...l, product: l.productId ? pmap.get(l.productId) || null : null }));
    }
  }
  if (!invoices.length) {
    return new Response('<h1>No invoices found</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const autoPrint = url.searchParams.get('auto') !== '0';
  const html = await renderBulkInvoicesHtml(invoices as any, { autoPrint });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
