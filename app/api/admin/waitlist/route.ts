// Admin Waitlist view — list signups, optionally filtered by product.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const productId = url.searchParams.get('productId');

  const where: any = {};
  if (productId) where.productId = productId;

  const entries = await prisma.waitlist.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Group counts per product
  const counts = await prisma.waitlist.groupBy({
    by: ['productId'],
    _count: { _all: true },
  });

  const productIds = counts.map(c => c.productId);
  const products = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, slug: true, status: true, fulfilmentMode: true, editionSize: true, editionSold: true },
      })
    : [];
  const byId = new Map(products.map(p => [p.id, p]));

  const summary = counts.map(c => ({
    productId: c.productId,
    count: c._count._all,
    product: byId.get(c.productId) || null,
  })).sort((a, b) => b.count - a.count);

  return NextResponse.json({ entries, summary });
}
