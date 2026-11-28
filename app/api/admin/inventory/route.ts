// Admin inventory - list variants with stock levels
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { dedupeMedia, toStringArray } from '@/lib/catalog/media-read';
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
    const low = {inventory:{gt:0,lte:prisma.variant.fields.lowStockThreshold}};
    const out = {inventory:0};
    const where: Prisma.VariantWhereInput = filter === 'low' ? low : filter === 'out' ? out : {};
    const rawPage=Number(url.searchParams.get('page') || 1);
    const pageSize=url.searchParams.has('page') ? 50 : 500;
    const [summary,lowCount,outCount]=await prisma.$transaction([
      prisma.variant.aggregate({_count:true,_sum:{inventory:true}}),
      prisma.variant.count({where:low}),
      prisma.variant.count({where:out}),
    ]);
    const matching=filter==='low' ? lowCount : filter==='out' ? outCount : summary._count;
    const pages=Math.max(1,Math.ceil(matching/pageSize));
    const page=Math.max(1,Math.min(pages,Number.isSafeInteger(rawPage)?rawPage:1));
    const variants = await prisma.variant.findMany({
      where, take:pageSize, skip:(page-1)*pageSize, orderBy:[{inventory:'asc'},{id:'asc'}],
      include: { product: { select: { id: true, name: true, slug: true, sku: true, images: true, status: true } } },
    });
    const result = variants.map(v => {
      const images=dedupeMedia([...toStringArray(v.images),...toStringArray(v.product.images)]);
      return {
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
      image: images[0] || null, images,
      isLow: v.inventory <= v.lowStockThreshold && v.inventory > 0,
      isOut: v.inventory === 0,
      };
    });
    return NextResponse.json({
      variants: result, page, pages, matching,
      stats:{totalVariants:summary._count,totalUnits:summary._sum.inventory || 0,lowCount,outCount},
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, variants: [], stats: {} }, { status: 500 });
  }
}
