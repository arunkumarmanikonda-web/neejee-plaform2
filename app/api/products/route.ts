import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';
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

const ROUTE_READ_MODEL_VERSION = 'phase1.public.products.v6';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const MAX_IDS = 100;
const MAX_QUERY_LENGTH = 120;

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
    .filter(Boolean)
    .slice(0, MAX_IDS);
}

function splitPath(pathValue: unknown): string[] {
  const path = asString(pathValue);
  if (!path) return [];
  return path.split('/').map((part) => part.trim()).filter(Boolean);
}

function boundedText(value: string | null, max = MAX_QUERY_LENGTH): string | null {
  const text = asString(value);
  if (!text) return null;
  return text.slice(0, max);
}

function parseRupees(value: string | null): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100_000_000) return null;
  return Math.round(parsed * 100);
}

function normalizeAudienceToken(value: string): string {
  return value.trim().replace(/[\s_-]+/g, '_').toUpperCase();
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
      { catalogueStockVisibility: { in: ['SHOW_ALL', 'HIDE_STOCK'] } },
      {
        AND: [
          { catalogueStockVisibility: 'IN_STOCK_ONLY' },
          { variants: { some: { inventory: { gt: 0 } } } },
        ],
      },
    ],
  };
}

function compareProducts(sort: string) {
  return (a: ReturnType<typeof buildProductReadModel>, b: ReturnType<typeof buildProductReadModel>) => {
    if (sort === 'price_asc') {
      if (a.pricing.effectivePrice !== b.pricing.effectivePrice) return a.pricing.effectivePrice - b.pricing.effectivePrice;
      return b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime();
    }
    if (sort === 'price_desc') {
      if (a.pricing.effectivePrice !== b.pricing.effectivePrice) return b.pricing.effectivePrice - a.pricing.effectivePrice;
      return b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime();
    }
    if (sort === 'name') return a.identity.name.localeCompare(b.identity.name, 'en', { sensitivity: 'base' });
    return [
      Number(b.catalogue.pinHero) - Number(a.catalogue.pinHero),
      Number(b.catalogue.featured) - Number(a.catalogue.featured),
      Number(b.catalogue.bestseller) - Number(a.catalogue.bestseller),
      b.timestamps.updatedAt.getTime() - a.timestamps.updatedAt.getTime(),
    ].find((value) => value !== 0) ?? 0;
  };
}

function mapPublicVariant(
  read: ReturnType<typeof buildProductReadModel>,
  variant: ReturnType<typeof buildProductReadModel>['variants'][number],
) {
  // Variant rows only store SKU/option/price/stock/media URLs. Publication,
  // catalogue curation and media-approval state live on the parent Product.
  // Public variant output therefore inherits those parent-level controls and
  // applies only the variant's own stock state as an additional blocker.
  const parentBlockers = Array.isArray(read.catalogueReadiness?.blockers)
    ? read.catalogueReadiness.blockers.filter((blocker: string) => blocker !== 'hidden_by_stock_rule')
    : [];
  const hiddenByVariantStock =
    variant.stock.stockVisibility === 'IN_STOCK_ONLY' && !variant.stock.inStock;
  const blockers = Array.from(new Set([
    ...parentBlockers,
    ...(hiddenByVariantStock ? ['hidden_by_stock_rule'] : []),
  ]));
  const readyForCatalogue = blockers.length === 0;
  const inheritedImageApproved = !!(variant.media?.imageApproved || read.media.imageApproved);
  const inheritedApprovedPrimaryImage =
    variant.media?.approvedPrimaryImage ?? read.media.approvedPrimaryImage ?? null;

  return {
    ...variant,
    active: read.identity.active,
    identity: {
      ...variant.identity,
      status: read.identity.status,
      active: read.identity.active,
      enabled: read.identity.enabled,
      published: read.identity.published,
    },
    media: {
      ...variant.media,
      approvedPrimaryImage: inheritedApprovedPrimaryImage,
      imageApproved: inheritedImageApproved,
      hasApprovedMedia: inheritedImageApproved && !!inheritedApprovedPrimaryImage,
    },
    catalogue: {
      ...variant.catalogue,
      featured: read.catalogue.featured,
      bestseller: read.catalogue.bestseller,
      editorial: read.catalogue.editorial,
      pinHero: read.catalogue.pinHero,
      exclude: read.catalogue.exclude,
      audienceTag: read.catalogue.audienceTag,
      ctaMode: read.catalogue.ctaMode,
      mode: read.catalogue.mode,
      storyBlock: read.catalogue.storyBlock,
      preferredImage: variant.catalogue?.preferredImage ?? read.catalogue.preferredImage,
      imageApproved: inheritedImageApproved,
      imageQualityScore: variant.catalogue?.imageQualityScore ?? read.catalogue.imageQualityScore,
      stockVisibility: variant.stock.stockVisibility,
      cta: read.catalogue.cta,
      readiness: {
        ...read.catalogueReadiness,
        ready: readyForCatalogue,
        readyForCatalogue,
        visibleInFeed: read.catalogueReadiness?.visibleInFeed ?? readyForCatalogue,
        usesApprovedMedia: inheritedImageApproved && !!inheritedApprovedPrimaryImage,
        blockers,
      },
    },
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
      visibleInListing: read.stock.stockVisibility === 'IN_STOCK_ONLY' ? read.stock.inStock : true,
    },
    variants: read.variants.map((variant) => mapPublicVariant(read, variant)),
    source: read.source,
    version: read.version,
    createdAt: read.timestamps.createdAt,
    updatedAt: read.timestamps.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const category = boundedText(url.searchParams.get('category'));
  const search = boundedText(url.searchParams.get('q')) || boundedText(url.searchParams.get('search'));
  const craft = boundedText(url.searchParams.get('craft'));
  const region = boundedText(url.searchParams.get('region'));
  const material = boundedText(url.searchParams.get('material'));
  const occasion = boundedText(url.searchParams.get('occasion'));
  const badge = boundedText(url.searchParams.get('badge'));
  const audience = boundedText(url.searchParams.get('audience'));
  const slug = boundedText(url.searchParams.get('slug'), 220);
  const excludeId = boundedText(url.searchParams.get('excludeId'), 120);
  const ids = parseCsv(url.searchParams.get('ids'));
  const minPriceRupees = url.searchParams.get('minPrice');
  const maxPriceRupees = url.searchParams.get('maxPrice');
  const minPricePaise = parseRupees(minPriceRupees);
  const maxPricePaise = parseRupees(maxPriceRupees);
  const sort = boundedText(url.searchParams.get('sort'), 32) || 'newest';
  const featured = boundedText(url.searchParams.get('featured'), 32);
  const arEligible = truthyParam(url.searchParams.get('arEligible'));
  const mirrorEligible = truthyParam(url.searchParams.get('mirrorEligible'));
  const page = Math.min(asPositiveInt(url.searchParams.get('page'), DEFAULT_PAGE), 10000);
  const limit = Math.min(asPositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);

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
      if (resolved?.where && Object.keys(resolved.where).length > 0) andClauses.push(resolved.where);
    }

    if (slug) andClauses.push({ slug: { equals: slug, mode: 'insensitive' } });
    if (excludeId) andClauses.push({ id: { not: excludeId } });
    if (ids.length > 0) andClauses.push({ id: { in: ids } });
    if (craft) andClauses.push({ craft: { equals: craft, mode: 'insensitive' } });
    if (region) andClauses.push({ region: { equals: region, mode: 'insensitive' } });
    if (material) andClauses.push({ material: { contains: material, mode: 'insensitive' } });
    if (occasion) andClauses.push({ occasion: { contains: occasion, mode: 'insensitive' } });
    if (badge) andClauses.push({ badges: { has: badge } });
    if (audience) {
      andClauses.push({
        catalogueAudienceTag: {
          contains: normalizeAudienceToken(audience),
          mode: 'insensitive',
        },
      });
    }

    if (search) {
      andClauses.push({ OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { shortName: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { craft: { contains: search, mode: 'insensitive' } },
        { region: { contains: search, mode: 'insensitive' } },
        { artisanName: { contains: search, mode: 'insensitive' } },
        { material: { contains: search, mode: 'insensitive' } },
        { technique: { contains: search, mode: 'insensitive' } },
        { poeticLine: { contains: search, mode: 'insensitive' } },
        { category: { is: { name: { contains: search, mode: 'insensitive' } } } },
      ] });
    }

    if (arEligible) andClauses.push({ arTryOnEligible: true });
    if (mirrorEligible) andClauses.push({ aiTryOnEligible: true });
    if (featured === 'founder') andClauses.push({ badges: { has: "FOUNDER'S EDIT" } });
    if (featured === 'new') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      andClauses.push({ createdAt: { gte: thirtyDaysAgo } });
    }
    if (featured === 'true' || featured === 'catalogue') andClauses.push({ catalogueFeatured: true });
    if (featured === 'bestseller') andClauses.push({ catalogueBestseller: true });
    if (featured === 'editorial') andClauses.push({ catalogueEditorial: true });
    if (featured === 'hero') andClauses.push({ cataloguePinHero: true });

    const where = andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
    const now = new Date();
    const needsComputedFiltering =
      featured === 'sale' ||
      minPricePaise !== null ||
      maxPricePaise !== null ||
      sort === 'price_asc' ||
      sort === 'price_desc';

    let products: ReturnType<typeof mapPublicProduct>[] = [];
    let total = 0;

    if (!needsComputedFiltering) {
      // Production Prisma is intentionally configured with a small serverless pool.
      // Keep the two public listing reads sequential so a normal PLP request cannot
      // compete with itself for the only available pooled connection under load.
      total = await prisma.product.count({ where });
      const rows = await prisma.product.findMany({
        where,
        orderBy: buildBaseOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
        include: buildInclude(),
      });
      const reads = (rows as unknown as ProductReadSourceRow[])
        .map((row) => buildProductReadModel(row, 'public_api', now));
      products = reads.map(mapPublicProduct);
    } else {
      const rows = await prisma.product.findMany({
        where,
        orderBy: buildBaseOrderBy(sort),
        include: buildInclude(),
      });
      let reads = (rows as unknown as ProductReadSourceRow[])
        .map((row) => buildProductReadModel(row, 'public_api', now));
      if (featured === 'sale') reads = reads.filter((read) => read.pricing.onSale);
      if (minPricePaise !== null) reads = reads.filter((read) => read.pricing.effectivePrice >= minPricePaise);
      if (maxPricePaise !== null) reads = reads.filter((read) => read.pricing.effectivePrice <= maxPricePaise);
      reads.sort(compareProducts(sort));
      total = reads.length;
      const start = (page - 1) * limit;
      products = reads.slice(start, start + limit).map(mapPublicProduct);
    }

    const totalPages = total > 0 ? Math.ceil(total / limit) : 1;
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
        category, q: search, craft, region, material, occasion, badge, audience,
        slug, excludeId, ids, minPrice: minPriceRupees, maxPrice: maxPriceRupees,
        sort, featured, arEligible, mirrorEligible,
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
    response.headers.set('x-supported-stock-visibility', CATALOGUE_STOCK_VISIBILITY.join(','));
    response.headers.set('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=180');
    return response;
  } catch (error: any) {
    console.error('[products.public] failed', { message: error?.message });
    return NextResponse.json({ ok: false, error: 'Unable to load products right now' }, { status: 500 });
  }
}
