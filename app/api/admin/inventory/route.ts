// Admin inventory - list variants with stock levels
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter'); // 'low' | 'out' | null

  try {
    const where: any = {};
    if (filter === 'low') {
      // Will filter in JS since Prisma can't compare two columns directly without raw
    } else if (filter === 'out') {
      where.inventory = 0;
    }
    const variants = await prisma.variant.findMany({
      where, take: 500, orderBy: { inventory: 'asc' },
      include: { product: { select: { id: true, name: true, slug: true, sku: true, images: true, status: true } } },
    });
    let result = variants.map((v: any) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      inventory: v.inventory,
      lowStockThreshold: v.lowStockThreshold,
      productId: v.product.id,
      productName: v.product.name,
      productSlug: v.product.slug,
      productSku: v.product.sku,
      productStatus: v.product.status,
      image: Array.isArray(v.product.images) ? v.product.images[0] : null,
      isLow: v.inventory <= (v.lowStockThreshold || 3) && v.inventory > 0,
      isOut: v.inventory === 0,
    }));
    if (filter === 'low') result = result.filter((v: any) => v.isLow);

    const totalUnits = result.reduce((s: number, v: any) => s + (v.inventory || 0), 0);
    const lowCount = result.filter((v: any) => v.isLow).length;
    const outCount = result.filter((v: any) => v.isOut).length;

    return NextResponse.json({
      variants: result,
      stats: { totalVariants: result.length, totalUnits, lowCount, outCount },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, variants: [], stats: {} }, { status: 500 });
  }
}
