// Public products list endpoint — used by PLP, homepage carousels, search
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('q');
  const craft = url.searchParams.get('craft');
  const region = url.searchParams.get('region');
  const material = url.searchParams.get('material');
  const occasion = url.searchParams.get('occasion');
  const badge = url.searchParams.get('badge');
  const minPriceRupees = url.searchParams.get('minPrice');
  const maxPriceRupees = url.searchParams.get('maxPrice');
  const sort = url.searchParams.get('sort') || 'newest';
  const featured = url.searchParams.get('featured');
  const arEligible = url.searchParams.get('arEligible');     // ?arEligible=true — jewellery AR try-on filter
  const mirrorEligible = url.searchParams.get('mirrorEligible'); // ?mirrorEligible=true
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

  try {
    // Resolve category flexibly (slug → craft → name-fuzzy → all)
    let where: any;
    let matched: any = null;
    if (category) {
      const r = await resolveCategoryWhere(category);
      where = r.where;
      matched = r.matchedCategory;
    } else {
      where = { status: 'ACTIVE' };
    }

    if (craft) where.craft = { equals: craft, mode: 'insensitive' };
    if (region) where.region = { equals: region, mode: 'insensitive' };
    if (material) where.material = { contains: material, mode: 'insensitive' };
    if (occasion) where.occasion = { contains: occasion, mode: 'insensitive' };
    // v23.40.25 — badge filter (matches any product carrying this badge tag)
    if (badge) where.badges = { has: badge };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { craft: { contains: search, mode: 'insensitive' } },
        { region: { contains: search, mode: 'insensitive' } },
        { artisanName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (minPriceRupees || maxPriceRupees) {
      where.sellingPrice = {};
      if (minPriceRupees) where.sellingPrice.gte = parseInt(minPriceRupees) * 100;
      if (maxPriceRupees) where.sellingPrice.lte = parseInt(maxPriceRupees) * 100;
    }
    if (arEligible === 'true') where.arTryOnEligible = true;
    if (mirrorEligible === 'true') where.aiTryOnEligible = true;
    if (featured === 'founder') where.badges = { has: "FOUNDER'S EDIT" };
    if (featured === 'sale') {
      where.salePrice = { not: null };
      where.OR = [{ saleEndsAt: null }, { saleEndsAt: { gte: new Date() } }];
    }
    if (featured === 'new') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      where.createdAt = { gte: thirtyDaysAgo };
    }

    let orderBy: any = [{ createdAt: 'desc' }];
    if (sort === 'price_asc') orderBy = [{ sellingPrice: 'asc' }];
    if (sort === 'price_desc') orderBy = [{ sellingPrice: 'desc' }];
    if (sort === 'name') orderBy = [{ name: 'asc' }];

    const products = await prisma.product.findMany({
      where, take: limit, orderBy,
      include: {
        category: { select: { slug: true, name: true } },
        // v23.34.1 — also pull variant.images so the card thumbnail can fall back
        // to a variant photo when Product.images is empty.
        variants: { select: { id: true, inventory: true, images: true } },
      },
    });

    return NextResponse.json({
      matchedCategory: matched,
      products: products.map((p: any) => ({
        id: p.id, slug: p.slug, sku: p.sku, name: p.name,
        shortName: p.shortName, poeticLine: p.poeticLine,
        craft: p.craft, region: p.region,
        category: p.category?.slug, categoryName: p.category?.name,
        mrp: p.mrp, sellingPrice: p.sellingPrice,
        salePrice: p.salePrice, saleStartsAt: p.saleStartsAt, saleEndsAt: p.saleEndsAt,
        // Thumbnail strategy: prefer Product.images, else the first variant
        // image we can find. Keeps cards visually consistent when a product
        // is only photographed at variant scope.
        images: (() => {
          const base = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
          if (base.length > 0) return base;
          for (const v of (p.variants || [])) {
            const vi = Array.isArray((v as any).images) ? (v as any).images.filter(Boolean) : [];
            if (vi.length > 0) return vi;
          }
          return [];
        })(),
        badges: Array.isArray(p.badges) ? p.badges : [],
        aiTryOnEligible: !!p.aiTryOnEligible, aiRoomEligible: !!p.aiRoomEligible,
        codEligible: p.codEligible !== false, returnEligible: p.returnEligible !== false,
        returnPolicy: p.returnPolicy || null,
        inventory: p.variants.reduce((s: number, v: any) => s + (v.inventory || 0), 0),
      })),
      count: products.length,
    });
  } catch (e: any) {
    console.warn('[products API] DB query failed:', e.message);
    return NextResponse.json({ products: [], count: 0, error: e.message }, { status: 500 });
  }
}
