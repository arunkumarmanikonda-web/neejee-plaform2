import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';
import {
  asString,
  buildProductReadModel,
  toStringArray,
  type ProductReadSourceRow,
} from '@/lib/catalog/product-read';
import {
  CATALOGUE_STOCK_VISIBILITY,
  PRODUCT_READ_MODEL_VERSION,
} from '@/lib/catalog/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROUTE_READ_MODEL_VERSION = 'phase1.public.products.v3';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function asPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function truthyParam(value: string | null): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitPath(pathValue: unknown): string[] {
  const path = asString(pathValue);
  if (!path) return [];
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildInclude() {
  return {
    category: {
      select: {
        id: true,
        slug: true,
        name: true,
        path: true,
        level: true,
        parentId: true,
        parent: {
          select: {
            id: true,
            slug: true,
            name: true,
            path: true,
            level: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                slug: true,
                name: true,
                path: true,
                level: true,
                parentId: true,
              },
            },
          },
        },
      },
    },
    variants: {
      select: {
        id: true,
        sku: true,
        size: true,
        color: true,
        colorHex: true,
        material: true,
        inventory: true,
        lowStockThreshold: true,
        images: true,
        mrp: true,
        sellingPrice: true,
      },
      orderBy: { sku: 'asc' as const },
    },
  };
}

function buildBaseOrderBy(sort: string) {
  if (sort === 'name') return [{ name: 'asc' as const }, { updatedAt: 'desc' as const }];
  return [
    { cataloguePinHero: 'desc' as const },
    { catalogueFeatured: 'desc' as const },
    { catalogueBestseller: 'desc' as const },
    { updatedAt: 'desc' as const },
  ];
}

function buildPublicListingVisibilityWhere() {
  return {
    OR: [
      {
        catalogueStockVisibility: {
          in: ['SHOW_ALL', 'SHOW_EXACT', 'HIDE_STOCK'],
        },
      },
      {
        AND: [
          {
            OR: [
              { catalogueStockVisibility: 'IN_STOCK_ONLY' },
              { catalogueStockVisibility: 'LOW_STOCK_BADGE' },
              { catalogueStockVisibility: null },
            ],
          },
          {
            variants: {
              some: {
                inventory: { gt: 0 },
              },
            },
          },
        ],
      },
    ],
  };
}

function compareProducts(sort: string) {
  return (a: ReturnType<typeof buildProductReadModel>, b: ReturnType<typeof buildProductReadModel>) => {
    if (sort === 'price_asc') {
      if (a.pricing.effectivePrice !== b.pricing.effectivePrice) {
        return a.pricing.effectivePrice - b.pricing.effectivePrice;
      }
      return b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime();
    }

    if (sort === 'price_desc') {
      if (a.pricing.effectivePrice !== b.pricing.effectivePrice) {
        return b.pricing.effectivePrice - a.pricing.effectivePrice;
      }
      return b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime();
    }

    if (sort === 'name') {
      return a.identity.name.localeCompare(b.identity.name, 'en', { sensitivity: 'base' });
    }

    if (sort === 'featured') {
      return [
        Number(b.catalogue.pinHero) - Number(a.catalogue.pinHero),
        Number(b.catalogue.featured) - Number(a.catalogue.featured),
        Number(b.catalogue.bestseller) - Number(a.catalogue.bestseller),
        b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime(),
      ].find((value) => value !== 0) ?? 0;
    }

    return [
      Number(b.catalogue.pinHero) - Number(a.catalogue.pinHero),
      Number(b.catalogue.featured) - Number(a.catalogue.featured),
      Number(b.catalogue.bestseller) - Number(a.catalogue.bestseller),
      b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime(),
    ].find((value) => value !== 0) ?? 0;
  };
}

function mapPublicProduct(read: ReturnType<typeof buildProductReadModel>) {
  return {
    id: read.id,
    slug: read.slug,
    sku: read.sku,

    name: read.identity.name,
    title: read.identity.name,
    shortName: read.identity.shortName,
    poeticLine: read.identity.poeticLine,

    craft: read.craft.craft,
    region: read.craft.region,
    state: read.craft.state,
    cluster: read.craft.cluster,
    artisanName: read.craft.artisanName,
    material: read.craft.material,
    technique: read.craft.technique,
    occasion: read.craft.occasion,

    category: read.category?.slug ?? null,
    categoryName: read.category?.name ?? null,
    categoryPath: read.category?.path ?? null,
    categoryLevel: read.category?.level ?? null,
    categoryBreadcrumb: splitPath(read.hierarchy.path),
    hierarchy: read.hierarchy,

    mrp: read.pricing.mrp,
    sellingPrice: read.pricing.sellingPrice,
    salePrice: read.pricing.salePrice,
    saleStartsAt: read.pricing.saleWindow.startsAt,
    saleEndsAt: read.pricing.saleWindow.endsAt,
    pricing: read.pricing,

    image: read.media.primaryImage,
    primaryImage: read.media.primaryImage,
    approvedPrimaryImage: read.media.approvedPrimaryImage,
    preferredImage: read.media.preferredImage,
    images: read.media.gallery,
    productImages: read.media.productImages,
    variantImages: read.media.variantImages,
    imageApproved: read.media.imageApproved,
    imageQualityScore: read.media.imageQualityScore,
    imageSelectionMode: read.media.selectionMode,
    media: read.media,

    badges: read.badges,

    aiTryOnEligible: read.ai.tryOnEligible,
    aiRoomEligible: read.ai.roomEligible,
    arTryOnEligible: read.ai.arTryOnEligible,

    codEligible: read.policies.codEligible,
    returnEligible: read.policies.returnEligible,
    returnPolicy: read.policies.returnPolicy,

    catalogueFeatured: read.catalogue.featured,
    catalogueBestseller: read.catalogue.bestseller,
    catalogueEditorial: read.catalogue.editorial,
    cataloguePinHero: read.catalogue.pinHero,
    catalogueAudienceTag: read.catalogue.audienceTag,
    catalogueCtaMode: read.catalogue.ctaMode,
    catalogueStoryBlock: read.catalogue.storyBlock,
    catalogueReadiness: read.catalogueReadiness,

    stock: {
      ...read.stock,
      visibleInListing:
        read.stock.stockVisibility === 'IN_STOCK_ONLY' ? read.stock.inStock : true,
    },

    variants: read.variants,
    source: read.source,
    version: read.version,
    createdAt: read.timestamps.createdAt,
    updatedAt: read.timestamps.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const category = asString(url.searchParams.get('category'));
  const search = asString(url.searchParams.get('q')) || asString(url.searchParams.get('search'));
  const craft = asString(url.searchParams.get('craft'));
  const region = asString(url.searchParams.get('region'));
  const material = asString(url.searchParams.get('material'));
  const occasion = asString(url.searchParams.get('occasion'));
  const badge = asString(url.searchParams.get('badge'));
  const audience = asString(url.searchParams.get('audience'));
  const slug = asString(url.searchParams.get('slug'));
  const excludeId = asString(url.searchParams.get('excludeId'));
  const ids = parseCsv(url.searchParams.get('ids'));

  const minPriceRupees = asString(url.searchParams.get('minPrice'));
  const maxPriceRupees = asString(url.searchParams.get('maxPrice'));

  const sort = asString(url.searchParams.get('sort')) || 'newest';
  const featured = asString(url.searchParams.get('featured'));
  const arEligible = truthyParam(url.searchParams.get('arEligible'));
  const mirrorEligible = truthyParam(url.searchParams.get('mirrorEligible'));

  const page = asPositiveInt(url.searchParams.get('page'), DEFAULT_PAGE);
  const limit = Math.min(
    asPositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT),
    MAX_LIMIT
  );

  try {
    let matchedCategory: unknown = null;

    const andClauses: any[] = [
      { status: 'ACTIVE' },
      { catalogueExclude: false },
      buildPublicListingVisibilityWhere(),
    ];

    if (category) {
      const resolved = await resolveCategoryWhere(category);
      matchedCategory = resolved?.matchedCategory ?? null;
      if (resolved?.where && Object.keys(resolved.where).length > 0) {
        andClauses.push(resolved.where);
      }
    }

    if (slug) andClauses.push({ slug: { equals: slug, mode: 'insensitive' } });
    if (excludeId) andClauses.push({ id: { not: excludeId } });
    if (ids.length > 0) andClauses.push({ id: { in: ids } });
    if (craft) andClauses.push({ craft: { equals: craft, mode: 'insensitive' } });
    if (region) andClauses.push({ region: { equals: region, mode: 'insensitive' } });
    if (material) andClauses.push({ material: { contains: material, mode: 'insensitive' } });
    if (occasion) andClauses.push({ occasion: { contains: occasion, mode: 'insensitive' } });
    if (badge) andClauses.push({ badges: { has: badge } });
    if (audience) andClauses.push({ catalogueAudienceTag: audience });

    if (search) {
      andClauses.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { shortName: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { craft: { contains: search, mode: 'insensitive' } },
          { region: { contains: search, mode: 'insensitive' } },
          { artisanName: { contains: search, mode: 'insensitive' } },
          { material: { contains: search, mode: 'insensitive' } },
          { technique: { contains: search, mode: 'insensitive' } },
          { poeticLine: { contains: search, mode: 'insensitive' } },
          {
            category: {
              is: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          },
        ],
      });
    }

    if (arEligible) andClauses.push({ arTryOnEligible: true });
    if (mirrorEligible) andClauses.push({ aiTryOnEligible: true });

    if (featured === 'founder') {
      andClauses.push({ badges: { has: "FOUNDER'S EDIT" } });
    }
    if (featured === 'new') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      andClauses.push({ createdAt: { gte: thirtyDaysAgo } });
    }
    if (featured === 'true' || featured === 'catalogue') {
      andClauses.push({ catalogueFeatured: true });
    }
    if (featured === 'bestseller') {
      andClauses.push({ catalogueBestseller: true });
    }
    if (featured === 'editorial') {
      andClauses.push({ catalogueEditorial: true });
    }
    if (featured === 'hero') {
      andClauses.push({ cataloguePinHero: true });
    }

    const where = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

    const rows = (await prisma.product.findMany({
      where,
      orderBy: buildBaseOrderBy(sort),
      include: buildInclude(),
    })) as unknown as ProductReadSourceRow[];

    const now = new Date();

    let reads = rows.map((row) => buildProductReadModel(row, 'public_api', now));

    if (featured === 'sale') {
      reads = reads.filter((read) => read.pricing.onSale);
    }

    const minPricePaise = minPriceRupees ? (Number.parseInt(minPriceRupees, 10) || 0) * 100 : null;
    const maxPricePaise = maxPriceRupees ? (Number.parseInt(maxPriceRupees, 10) || 0) * 100 : null;

    if (minPricePaise !== null) {
      reads = reads.filter((read) => read.pricing.effectivePrice >= minPricePaise);
    }
    if (maxPricePaise !== null) {
      reads = reads.filter((read) => read.pricing.effectivePrice <= maxPricePaise);
    }

    reads.sort(compareProducts(sort));

    const total = reads.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;
    const start = (page - 1) * limit;
    const paged = reads.slice(start, start + limit);
    const products = paged.map(mapPublicProduct);

    const response = NextResponse.json({
      ok: true,
      matchedCategory,
      readModel: {
        version: ROUTE_READ_MODEL_VERSION,
        canonicalVersion: PRODUCT_READ_MODEL_VERSION,
        generatedAt: now.toISOString(),
        stockVisibility: CATALOGUE_STOCK_VISIBILITY,
      },
      filters: {
        category,
        q: search,
        craft,
        region,
        material,
        occasion,
        badge,
        audience,
        slug,
        excludeId,
        ids,
        minPrice: minPriceRupees,
        maxPrice: maxPriceRupees,
        sort,
        featured,
        arEligible,
        mirrorEligible,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      products,
      count: products.length,
    });

    response.headers.set('x-read-model-version', ROUTE_READ_MODEL_VERSION);
    response.headers.set('x-canonical-read-model-version', PRODUCT_READ_MODEL_VERSION);
    response.headers.set(
      'x-supported-stock-visibility',
      CATALOGUE_STOCK_VISIBILITY.join(',')
    );

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to load products',
      },
      { status: 500 }
    );
  }
}
