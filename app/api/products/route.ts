﻿import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const READ_MODEL_VERSION = 'phase1.public.products.v2';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

const CANONICAL_STOCK_VISIBILITY = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

type CanonicalStockVisibility =
  (typeof CANONICAL_STOCK_VISIBILITY)[number];

type VariantRow = {
  id: string;
  inventory: number | null;
  lowStockThreshold: number | null;
  images: unknown;
};

type CategoryParentRow = {
  id: string;
  name: string;
  slug: string;
  path: string | null;
  level: number | null;
  parentId: string | null;
  parent?: CategoryParentRow | null;
} | null;

type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  shortName: string | null;
  poeticLine: string | null;
  craft: string | null;
  region: string | null;
  state: string | null;
  cluster: string | null;
  artisanName: string | null;
  material: string | null;
  technique: string | null;
  occasion: string | null;

  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;

  images: unknown;
  badges: unknown;

  status: string;
  catalogueExclude: boolean | null;
  catalogueFeatured: boolean | null;
  catalogueBestseller: boolean | null;
  catalogueEditorial: boolean | null;
  cataloguePinHero: boolean | null;
  cataloguePreferredImage: string | null;
  catalogueAudienceTag: string | null;
  catalogueCtaMode: string | null;
  catalogueStoryBlock: string | null;
  catalogueImageApproved: boolean | null;
  catalogueImageQualityScore: number | null;
  catalogueStockVisibility: string | null;

  aiTryOnEligible: boolean | null;
  aiRoomEligible: boolean | null;
  arTryOnEligible: boolean | null;

  codEligible: boolean | null;
  returnEligible: boolean | null;
  returnPolicy: string | null;

  createdAt: Date;
  updatedAt: Date;

  category:
    | {
        id: string;
        slug: string;
        name: string;
        path: string | null;
        level: number | null;
        parentId: string | null;
        parent: CategoryParentRow;
      }
    | null;

  variants: VariantRow[];
};

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

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

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item === undefined || item === null) return '';
      return String(item).trim();
    })
    .filter((item): item is string => item.length > 0);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeStockVisibility(
  value: unknown
): CanonicalStockVisibility {
  const raw = asString(value)?.toUpperCase();

  if (!raw) return 'IN_STOCK_ONLY';
  if (raw === 'SHOW_ALL' || raw === 'SHOW_EXACT') return 'SHOW_ALL';
  if (raw === 'HIDE_STOCK') return 'HIDE_STOCK';
  if (raw === 'LOW_STOCK_BADGE' || raw === 'IN_STOCK_ONLY') {
    return 'IN_STOCK_ONLY';
  }

  return 'IN_STOCK_ONLY';
}

function isSaleLive(product: ProductRow, now = new Date()): boolean {
  const salePrice =
    typeof product.salePrice === "number"
      ? product.salePrice
      : Number.parseInt(String(product.salePrice ?? ''), 10);

  const sellingPrice =
    typeof product.sellingPrice === "number"
      ? product.sellingPrice
      : Number.parseInt(String(product.sellingPrice ?? ''), 10);

  if (!Number.isFinite(salePrice) || salePrice <= 0) return false;
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return false;
  if (salePrice >= sellingPrice) return false;

  const startsAt = product.saleStartsAt ? new Date(product.saleStartsAt) : null;
  const endsAt = product.saleEndsAt ? new Date(product.saleEndsAt) : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) return false;
  if (endsAt && Number.isNaN(endsAt.getTime())) return false;

  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;

  return true;
}

function buildPricing(product: ProductRow, now = new Date()) {
  const mrp =
    typeof product.mrp === 'number'
      ? product.mrp
      : Number.parseInt(String(product.mrp ?? 0), 10) || 0;

  const sellingPrice =
    typeof product.sellingPrice === 'number'
      ? product.sellingPrice
      : Number.parseInt(String(product.sellingPrice ?? 0), 10) || 0;

  const liveSale = isSaleLive(product, now);

  const parsedSalePrice =
    typeof product.salePrice === 'number'
      ? product.salePrice
      : Number.parseInt(String(product.salePrice ?? 0), 10) || 0;

  const salePrice = liveSale && parsedSalePrice > 0 ? parsedSalePrice : null;
  const effectivePrice = salePrice && salePrice > 0 ? salePrice : sellingPrice;

  const discountAmount =
    mrp > 0 && effectivePrice > 0 && mrp > effectivePrice
      ? mrp - effectivePrice
      : 0;

  const discountPercent =
    mrp > 0 && discountAmount > 0
      ? Math.round((discountAmount / mrp) * 100)
      : 0;

  return {
    mrp,
    sellingPrice,
    salePrice,
    effectivePrice,
    onSale: liveSale,
    discountAmount,
    discountPercent,
    saleStartsAt: product.saleStartsAt ?? null,
    saleEndsAt: product.saleEndsAt ?? null,
    currency: 'INR',
  };
}

function chooseImages(product: ProductRow) {
  const preferredImage = asString(product.cataloguePreferredImage);

  const productImages = dedupeStrings(toStringArray(product.images));
  const variantImages = dedupeStrings(
    (Array.isArray(product.variants) ? product.variants : []).flatMap(
      (variant) => toStringArray(variant?.images)
    )
  );

  const gallery = dedupeStrings([...productImages, ...variantImages]);

  let primaryImage: string | null = null;
  let selectionMode = 'none';

  if (preferredImage) {
    primaryImage = preferredImage;
    selectionMode = 'preferred_override';
  } else if (productImages.length > 0) {
    primaryImage = productImages[0];
    selectionMode = 'product_gallery';
  } else if (variantImages.length > 0) {
    primaryImage = variantImages[0];
    selectionMode = 'variant_fallback';
  }

  return {
    primaryImage,
    preferredImage,
    gallery,
    productImages,
    variantImages,
    selectionMode,
    imageApproved: !!product.catalogueImageApproved,
    imageQualityScore: product.catalogueImageQualityScore ?? null,
  };
}

function buildStock(product: ProductRow) {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  const totalInventory = variants.reduce((sum, variant) => {
    const qty =
      typeof variant?.inventory === 'number'
        ? variant.inventory
        : Number.parseInt(String(variant?.inventory ?? 0), 10) || 0;

    return sum + qty;
  }, 0);

  const lowStock = variants.some((variant) => {
    const qty =
      typeof variant?.inventory === 'number'
        ? variant.inventory
        : Number.parseInt(String(variant?.inventory ?? 0), 10) || 0;

    const threshold =
      typeof variant?.lowStockThreshold === 'number'
        ? variant.lowStockThreshold
        : Number.parseInt(String(variant?.lowStockThreshold ?? 3), 10) || 3;

    return qty > 0 && qty <= threshold;
  });

  const stockVisibility = normalizeStockVisibility(
    product.catalogueStockVisibility
  );

  const inStock = totalInventory > 0;
  const availableQuantity =
    stockVisibility === 'SHOW_ALL' ? totalInventory : null;

  let label = 'Out of stock';

  if (stockVisibility === 'HIDE_STOCK') {
    label = inStock ? 'Available' : 'Unavailable';
  } else if (stockVisibility === 'SHOW_ALL') {
    label = inStock ? `${totalInventory} available` : 'Out of stock';
  } else {
    label = inStock ? (lowStock ? 'Low stock' : 'In stock') : 'Out of stock';
  }

  return {
    inStock,
    totalInventory,
    lowStock,
    stockVisibility,
    availableQuantity,
    label,
    visibleInListing:
      stockVisibility === 'IN_STOCK_ONLY' ? inStock : true,
  };
}

function splitPath(pathValue: unknown): string[] {
  const path = asString(pathValue);
  if (!path) return [];
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildHierarchy(category: ProductRow['category']) {
  if (!category) {
    return {
      lineage: [],
      breadcrumb: [],
      breadcrumbSlugs: [],
      path: null,
      depth: 0,
      mainCategory: null,
      subCategory: null,
      subSubCategory: null,
      leafCategory: null,
    };
  }

  const lineage: Array<{
    id: string;
    name: string;
    slug: string;
    path: string | null;
    level: number | null;
    parentId: string | null;
  }> = [];

  let current: CategoryParentRow | ProductRow['category'] = category;

  while (current) {
    lineage.push({
      id: current.id,
      name: current.name,
      slug: current.slug,
      path: current.path ?? null,
      level: current.level ?? null,
      parentId: current.parentId ?? null,
    });

    current = current.parent ?? null;
  }

  lineage.reverse();

  return {
    lineage,
    breadcrumb: lineage.map((node) => node.name),
    breadcrumbSlugs: lineage.map((node) => node.slug),
    path:
      asString(category.path) ||
      (lineage.length > 0 ? lineage.map((node) => node.slug).join('/') : null),
    depth: lineage.length,
    mainCategory: lineage[0] ?? null,
    subCategory: lineage[1] ?? null,
    subSubCategory: lineage[2] ?? null,
    leafCategory: lineage[lineage.length - 1] ?? null,
  };
}

function buildOrderBy(sort: string) {
  if (sort === 'price_asc') {
    return [{ sellingPrice: 'asc' as const }, { updatedAt: 'desc' as const }];
  }

  if (sort === 'price_desc') {
    return [{ sellingPrice: 'desc' as const }, { updatedAt: 'desc' as const }];
  }

  if (sort === 'name') {
    return [{ name: 'asc' as const }, { updatedAt: 'desc' as const }];
  }

  if (sort === 'featured') {
    return [
      { cataloguePinHero: 'desc' as const },
      { catalogueFeatured: 'desc' as const },
      { catalogueBestseller: 'desc' as const },
      { updatedAt: 'desc' as const },
    ];
  }

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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const category = asString(url.searchParams.get('category'));
  const search =
    asString(url.searchParams.get('q')) ||
    asString(url.searchParams.get('search'));
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
  const skip = (page - 1) * limit;

  try {
    let matchedCategory: any = null;

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

    if (slug) {
      andClauses.push({ slug: { equals: slug, mode: 'insensitive' } });
    }

    if (excludeId) {
      andClauses.push({ id: { not: excludeId } });
    }

    if (ids.length > 0) {
      andClauses.push({ id: { in: ids } });
    }

    if (craft) {
      andClauses.push({ craft: { equals: craft, mode: 'insensitive' } });
    }

    if (region) {
      andClauses.push({ region: { equals: region, mode: 'insensitive' } });
    }

    if (material) {
      andClauses.push({ material: { contains: material, mode: 'insensitive' } });
    }

    if (occasion) {
      andClauses.push({ occasion: { contains: occasion, mode: 'insensitive' } });
    }

    if (badge) {
      andClauses.push({ badges: { has: badge } });
    }

    if (audience) {
      andClauses.push({ catalogueAudienceTag: audience });
    }

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
        ],
      });
    }

    if (minPriceRupees || maxPriceRupees) {
      const priceWhere: any = {};

      if (minPriceRupees) {
        priceWhere.gte =
          (Number.parseInt(minPriceRupees, 10) || 0) * 100;
      }

      if (maxPriceRupees) {
        priceWhere.lte =
          (Number.parseInt(maxPriceRupees, 10) || 0) * 100;
      }

      andClauses.push({ sellingPrice: priceWhere });
    }

    if (arEligible) {
      andClauses.push({ arTryOnEligible: true });
    }

    if (mirrorEligible) {
      andClauses.push({ aiTryOnEligible: true });
    }

    if (featured === 'founder') {
      andClauses.push({ badges: { has: "FOUNDER'S EDIT" } });
    }

    if (featured === 'sale') {
      andClauses.push({ salePrice: { not: null } });
      andClauses.push({
        OR: [{ saleStartsAt: null }, { saleStartsAt: { lte: new Date() } }],
      });
      andClauses.push({
        OR: [{ saleEndsAt: null }, { saleEndsAt: { gte: new Date() } }],
      });
    }

    if (featured === 'new') {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      );
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

    const where =
      andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: buildOrderBy(sort),
        include: {
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
              inventory: true,
              lowStockThreshold: true,
              images: true,
            },
          },
        },
      }),
    ]);

    const now = new Date();

    const mapped = (products as ProductRow[]).map((product) => {
      const media = chooseImages(product);
      const pricing = buildPricing(product, now);
      const stock = buildStock(product);
      const hierarchy = buildHierarchy(product.category);

      return {
        id: product.id,
        slug: product.slug,
        sku: product.sku,

        name: product.name,
        title: product.name,
        shortName: product.shortName,
        poeticLine: product.poeticLine,

        craft: product.craft,
        region: product.region,
        state: product.state,
        cluster: product.cluster,
        artisanName: product.artisanName,
        material: product.material,
        technique: product.technique,
        occasion: product.occasion,

        category: product.category?.slug || null,
        categoryName: product.category?.name || null,
        categoryPath: product.category?.path || null,
        categoryLevel: product.category?.level ?? null,
        categoryBreadcrumb: splitPath(product.category?.path),
        hierarchy,

        mrp: pricing.mrp,
        sellingPrice: pricing.sellingPrice,
        salePrice: pricing.salePrice,
        saleStartsAt: pricing.saleStartsAt,
        saleEndsAt: pricing.saleEndsAt,
        pricing,

        image: media.primaryImage,
        primaryImage: media.primaryImage,
        preferredImage: media.preferredImage,
        images: media.gallery,
        productImages: media.productImages,
        variantImages: media.variantImages,
        imageApproved: media.imageApproved,
        imageQualityScore: media.imageQualityScore,
        imageSelectionMode: media.selectionMode,
        media,

        badges: toStringArray(product.badges),

        aiTryOnEligible: !!product.aiTryOnEligible,
        aiRoomEligible: !!product.aiRoomEligible,
        arTryOnEligible: !!product.arTryOnEligible,

        codEligible: product.codEligible !== false,
        returnEligible: product.returnEligible !== false,
        returnPolicy: product.returnPolicy || null,

        catalogueFeatured: !!product.catalogueFeatured,
        catalogueBestseller: !!product.catalogueBestseller,
        catalogueEditorial: !!product.catalogueEditorial,
        cataloguePinHero: !!product.cataloguePinHero,
        catalogueAudienceTag: product.catalogueAudienceTag || null,
        catalogueCtaMode: product.catalogueCtaMode || null,
        catalogueStoryBlock: product.catalogueStoryBlock || null,

        stock,
        inventory: stock.totalInventory,
        inStock: stock.inStock,
        lowStock: stock.lowStock,

        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    const response = NextResponse.json({
      ok: true,
      matchedCategory,
      readModel: {
        version: READ_MODEL_VERSION,
        generatedAt: now.toISOString(),
        stockVisibility: CANONICAL_STOCK_VISIBILITY,
      },
      filters: {
        category: category ?? null,
        q: search ?? null,
        craft: craft ?? null,
        region: region ?? null,
        material: material ?? null,
        occasion: occasion ?? null,
        badge: badge ?? null,
        audience: audience ?? null,
        featured: featured ?? null,
        slug: slug ?? null,
        excludeId: excludeId ?? null,
        ids,
        minPrice: minPriceRupees ?? null,
        maxPrice: maxPriceRupees ?? null,
        sort,
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
      products: mapped,
      count: mapped.length,
    });

    response.headers.set('x-read-model-version', READ_MODEL_VERSION);
    response.headers.set(
      'x-supported-stock-visibility',
      CANONICAL_STOCK_VISIBILITY.join(',')
    );

    return response;
  } catch (e: any) {
    console.warn('[products API] DB query failed:', e?.message || e);

    return NextResponse.json(
      {
        ok: false,
        products: [],
        count: 0,
        error: e?.message || 'Failed to load products',
      },
      { status: 500 }
    );
  }
}
