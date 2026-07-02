import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asString,
  buildProductReadModel,
  type ProductReadSourceRow,
} from '@/lib/catalog/product-read';
import {
  CATALOGUE_STOCK_VISIBILITY,
  PRODUCT_READ_MODEL_VERSION,
} from '@/lib/catalog/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROUTE_READ_MODEL_VERSION = 'phase1.catalog.v3';
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

async function resolveCategoryFilter(rawCategory: string) {
  const category = rawCategory.trim();

  if (!category || category.toLowerCase() === 'all') {
    return {
      where: {},
      matchedCategory: null,
      matchMode: null,
    };
  }

  const matchedCategory = await prisma.category.findFirst({
    where: {
      OR: [
        { path: category },
        { slug: category },
        { name: { equals: category, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      path: true,
      level: true,
      parentId: true,
    },
  });

  if (matchedCategory) {
    return {
      where: matchedCategory.path
        ? {
            category: {
              is: {
                path: {
                  startsWith: matchedCategory.path,
                },
              },
            },
          }
        : {
            category: {
              is: {
                id: matchedCategory.id,
              },
            },
          },
      matchedCategory,
      matchMode: matchedCategory.path === category ? 'path' : 'category',
    };
  }

  return {
    where: {
      OR: [
        { craft: { equals: category, mode: 'insensitive' } },
        { material: { contains: category, mode: 'insensitive' } },
        { technique: { contains: category, mode: 'insensitive' } },
        { occasion: { contains: category, mode: 'insensitive' } },
      ],
    },
    matchedCategory: null,
    matchMode: 'fallback',
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

function buildInclude() {
  return {
    category: {
      select: {
        id: true,
        name: true,
        slug: true,
        path: true,
        level: true,
        parentId: true,
        parent: {
          select: {
            id: true,
            name: true,
            slug: true,
            path: true,
            level: true,
            parentId: true,
            parent: {
              select: {
                id: true,
                name: true,
                slug: true,
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
      orderBy: { sku: 'asc' as const },
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
    },
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

    return [
      Number(b.catalogue.pinHero) - Number(a.catalogue.pinHero),
      Number(b.catalogue.featured) - Number(a.catalogue.featured),
      Number(b.catalogue.bestseller) - Number(a.catalogue.bestseller),
      b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime(),
    ].find((value) => value !== 0) ?? 0;
  };
}

function mapCatalogueProduct(read: ReturnType<typeof buildProductReadModel>) {
  return {
    id: read.id,
    slug: read.slug,
    sku: read.sku,
    sellerId: read.sellerId,

    title: read.identity.name,
    name: read.identity.name,
    shortName: read.identity.shortName,
    poeticLine: read.identity.poeticLine,

    category: read.category
      ? {
          id: read.category.id,
          name: read.category.name,
          slug: read.category.slug,
          path: read.category.path,
          level: read.category.level,
          parentId: read.category.parentId,
          breadcrumb: read.hierarchy.breadcrumb,
          breadcrumbSlugs: read.hierarchy.breadcrumbSlugs,
        }
      : null,

    hierarchy: read.hierarchy,
    media: read.media,
    pricing: read.pricing,
    stock: read.stock,

    editorial: {
      featured: read.catalogue.featured,
      bestseller: read.catalogue.bestseller,
      editorial: read.catalogue.editorial,
      pinHero: read.catalogue.pinHero,
      exclude: read.catalogue.exclude,
      audienceTag: read.catalogue.audienceTag,
      ctaMode: read.catalogue.ctaMode,
      storyBlock: read.catalogue.storyBlock,
    },

    content: {
      description: read.identity.description,
      story: read.craft.story,
      craftNote: read.craft.craftNote,
      careInstructions: read.craft.careInstructions,
      sustainabilityNote: read.craft.sustainabilityNote,
    },

    attributes: {
      craft: read.craft.craft,
      region: read.craft.region,
      state: read.craft.state,
      cluster: read.craft.cluster,
      artisanName: read.craft.artisanName,
      material: read.craft.material,
      technique: read.craft.technique,
      occasion: read.craft.occasion,
      badges: read.badges,
    },

    commerce: {
      status: read.status,
      codEligible: read.policies.codEligible,
      returnEligible: read.policies.returnEligible,
      returnPolicy: read.policies.returnPolicy,
      fulfilmentMode: read.fulfilment.mode,
      depositPercent: read.fulfilment.depositPercent,
      releaseDate: read.fulfilment.releaseDate,
      editionSize: read.fulfilment.editionSize,
      editionSold: read.fulfilment.editionSold,
    },

    ai: {
      aiTryOnEligible: read.ai.tryOnEligible,
      aiRoomEligible: read.ai.roomEligible,
      arTryOnEligible: read.ai.arTryOnEligible,
    },

    selection: {
      preferredImageApplied: read.media.selectionMode === 'preferred_override',
      usedVariantImageFallback: read.media.selectionMode === 'variant_fallback',
      excludedFromCatalogue: read.catalogue.exclude,
      approvedMediaOnly: true,
      stockVisibilityRule: read.stock.stockVisibility,
    },

    catalogueReadiness: read.catalogueReadiness,
    variants: read.variants,
    source: read.source,
    version: read.version,
    timestamps: read.timestamps,
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const category = asString(url.searchParams.get('category'));
  const search = asString(url.searchParams.get('q')) || asString(url.searchParams.get('search'));
  const audience = asString(url.searchParams.get('audience'));
  const featured = truthyParam(url.searchParams.get('featured'));
  const hero = truthyParam(url.searchParams.get('hero'));
  const ready = truthyParam(url.searchParams.get('ready')) || truthyParam(url.searchParams.get('catalogueReady'));
  const includeExcluded = truthyParam(url.searchParams.get('includeExcluded'));
  const publicOnly = !truthyParam(url.searchParams.get('publicOnly')) ? false : true;
  const approvedMediaOnly = truthyParam(url.searchParams.get('approvedMediaOnly'));
  const slug = asString(url.searchParams.get('slug'));
  const excludeId = asString(url.searchParams.get('excludeId'));
  const ids = parseCsv(url.searchParams.get('ids'));
  const minPriceRupees = asString(url.searchParams.get('minPrice'));
  const maxPriceRupees = asString(url.searchParams.get('maxPrice'));
  const sort = asString(url.searchParams.get('sort')) || 'newest';
  const page = asPositiveInt(url.searchParams.get('page'), DEFAULT_PAGE);
  const limit = Math.min(asPositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);

  try {
    let matchedCategory: unknown = null;
    let matchMode: string | null = null;

    const andClauses: any[] = [{ status: 'ACTIVE' }];

    if (!includeExcluded) {
      andClauses.push({ catalogueExclude: false });
    }

    if (category) {
      const resolved = await resolveCategoryFilter(category);
      matchedCategory = resolved.matchedCategory;
      matchMode = resolved.matchMode;
      if (resolved.where && Object.keys(resolved.where).length > 0) {
        andClauses.push(resolved.where);
      }
    }

    if (search) {
      andClauses.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { shortName: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { poeticLine: { contains: search, mode: 'insensitive' } },
          { craft: { contains: search, mode: 'insensitive' } },
          { material: { contains: search, mode: 'insensitive' } },
          { technique: { contains: search, mode: 'insensitive' } },
          { region: { contains: search, mode: 'insensitive' } },
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

    if (audience) andClauses.push({ catalogueAudienceTag: audience });
    if (featured) andClauses.push({ catalogueFeatured: true });
    if (hero) andClauses.push({ cataloguePinHero: true });
    if (slug) andClauses.push({ slug: { equals: slug, mode: 'insensitive' } });
    if (excludeId) andClauses.push({ id: { not: excludeId } });
    if (ids.length > 0) andClauses.push({ id: { in: ids } });

    const where = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

    const rows = (await prisma.product.findMany({
      where,
      orderBy: buildBaseOrderBy(sort),
      include: buildInclude(),
    })) as unknown as ProductReadSourceRow[];

    const now = new Date();
    let reads = rows.map((row) => buildProductReadModel(row, 'catalogue', now));

    const minPricePaise = minPriceRupees ? (Number.parseInt(minPriceRupees, 10) || 0) * 100 : null;
    const maxPricePaise = maxPriceRupees ? (Number.parseInt(maxPriceRupees, 10) || 0) * 100 : null;

    if (publicOnly) {
      reads = reads.filter((read) =>
        read.stock.stockVisibility === 'IN_STOCK_ONLY' ? read.stock.inStock : true
      );
    }

    if (approvedMediaOnly) {
      reads = reads.filter((read) => read.media.hasApprovedMedia);
    }

    if (ready) {
      reads = reads.filter((read) => read.catalogueReadiness.readyForCatalogue);
    }

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
    const items = paged.map(mapCatalogueProduct);

    const response = NextResponse.json({
      ok: true,
      readModel: {
        version: ROUTE_READ_MODEL_VERSION,
        canonicalVersion: PRODUCT_READ_MODEL_VERSION,
        generatedAt: now.toISOString(),
        approvedMediaRequired: approvedMediaOnly,
        supportedStockVisibility: CATALOGUE_STOCK_VISIBILITY,
      },
      filters: {
        category,
        q: search,
        audience,
        featured,
        hero,
        ready,
        includeExcluded,
        publicOnly,
        approvedMediaOnly,
        slug,
        excludeId,
        ids,
        minPrice: minPriceRupees,
        maxPrice: maxPriceRupees,
        sort,
      },
      matchedCategory,
      matchMode,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      count: items.length,
      totalCount: total,
      items,
      products: items,
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
        error: error?.message || 'Failed to load catalogue products',
      },
      { status: 500 }
    );
  }
}
