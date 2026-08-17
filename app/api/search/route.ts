import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SUGGESTIONS = ['Banarasi', 'Phulkari', 'Kanjeevaram', 'Attar', 'Jhumkas', 'Pashmina', 'Chanderi', 'Ajrakh'];

function effectivePrice(product: any, now: Date): number {
  const saleLive =
    product.salePrice != null &&
    (!product.saleStartsAt || product.saleStartsAt <= now) &&
    (!product.saleEndsAt || product.saleEndsAt >= now);
  return Number(saleLive ? product.salePrice : product.sellingPrice || 0);
}

function primaryImage(product: any): string | null {
  if (product.catalogueImageApproved && product.cataloguePreferredImage) return product.cataloguePreferredImage;
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  if (images[0]) return images[0];
  for (const variant of product.variants || []) {
    const variantImages = Array.isArray(variant?.images) ? variant.images.filter(Boolean) : [];
    if (variantImages[0]) return variantImages[0];
  }
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 120);

  if (q.length < 2) {
    const response = NextResponse.json({ results: [], suggestions: SUGGESTIONS });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return response;
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        catalogueExclude: false,
        AND: [
          {
            OR: [
              { catalogueStockVisibility: { in: ['SHOW_ALL', 'HIDE_STOCK'] } },
              { catalogueStockVisibility: 'IN_STOCK_ONLY', variants: { some: { inventory: { gt: 0 } } } },
            ],
          },
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { shortName: { contains: q, mode: 'insensitive' } },
              { craft: { contains: q, mode: 'insensitive' } },
              { region: { contains: q, mode: 'insensitive' } },
              { material: { contains: q, mode: 'insensitive' } },
              { technique: { contains: q, mode: 'insensitive' } },
              { artisanName: { contains: q, mode: 'insensitive' } },
              { poeticLine: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      orderBy: [
        { catalogueFeatured: 'desc' },
        { catalogueBestseller: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: 12,
      select: {
        id: true,
        slug: true,
        sku: true,
        name: true,
        shortName: true,
        poeticLine: true,
        craft: true,
        region: true,
        material: true,
        artisanName: true,
        mrp: true,
        sellingPrice: true,
        salePrice: true,
        saleStartsAt: true,
        saleEndsAt: true,
        images: true,
        badges: true,
        aiTryOnEligible: true,
        aiRoomEligible: true,
        cataloguePreferredImage: true,
        catalogueImageApproved: true,
        catalogueStockVisibility: true,
        variants: {
          select: {
            inventory: true,
            images: true,
          },
        },
      },
    });

    const now = new Date();
    const results = products.map((product) => {
      const inventory = product.variants.reduce((sum, variant) => sum + Math.max(0, variant.inventory || 0), 0);
      return {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        shortName: product.shortName,
        poeticLine: product.poeticLine,
        craft: product.craft,
        region: product.region,
        material: product.material,
        artisanName: product.artisanName,
        mrp: product.mrp,
        sellingPrice: effectivePrice(product, now),
        salePrice: product.salePrice,
        images: primaryImage(product) ? [primaryImage(product)] : [],
        image: primaryImage(product),
        badges: product.badges,
        aiTryOnEligible: product.aiTryOnEligible,
        aiRoomEligible: product.aiRoomEligible,
        inventory,
        inStock: inventory > 0,
      };
    });

    const response = NextResponse.json({ results, count: results.length, query: q, source: 'catalogue' });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
    return response;
  } catch (error: any) {
    console.error('[search.public] failed', { message: error?.message });
    return NextResponse.json({ error: 'Search is temporarily unavailable', results: [], count: 0, query: q }, { status: 503 });
  }
}
