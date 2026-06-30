import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const READ_MODEL_VERSION = 'phase1.catalog.v2';

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

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  path: string | null;
  level: number | null;
  parentId: string | null;
  parent?: CategoryNode | null;
} | null;

type VariantRow = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  material: string | null;
  inventory: number | null;
  lowStockThreshold: number | null;
  images: unknown;
  mrp: number | null;
  sellingPrice: number | null;
};

type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  sellerId: string | null;

  name: string;
  shortName: string | null;
  poeticLine: string | null;
  description: string | null;

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
  gstRate: number | null;
  hsnCode: string | null;

  images: unknown;
  video: string | null;

  story: string | null;
  craftNote: string | null;
  careInstructions: string | null;
  sustainabilityNote: string | null;

  badges: unknown;

  status: string;
  catalogueFeatured: boolean | null;
  catalogueBestseller: boolean | null;
  catalogueEditorial: boolean | null;
  cataloguePinHero: boolean | null;
  catalogueExclude: boolean | null;
  cataloguePreferredImage: string | null;
  catalogueAudienceTag: string | null;
  catalogueCtaMode: string | null;
  catalogueStoryBlock: string | null;
  catalogueImageApproved: boolean | null;
  catalogueImageQualityScore: number | null;
  catalogueStockVisibility: string | null;

  codEligible: boolean | null;
  returnEligible: boolean | null;
  returnPolicy: string | null;
  fulfilmentMode: string | null;
  depositPercent: number | null;
  releaseDate: Date | null;
  editionSize: number | null;
  editionSold: number | null;

  aiTryOnEligible: boolean | null;
  aiRoomEligible: boolean | null;
  arTryOnEligible: boolean | null;

  createdAt: Date;
  updatedAt: Date;

  category: CategoryNode;
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
    typeof product.salePrice === 'number'
      ? product.salePrice
      : Number.parseInt(String(product.salePrice ?? ''), 10);

  const sellingPrice =
    typeof product.sellingPrice === 'number'
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
    displayPrice: effectivePrice,
    onSale: liveSale,
    discountAmount,
    discountPercent,
    saleWindow: {
      startsAt: product.saleStartsAt ?? null,
      endsAt: product.saleEndsAt ?? null,
    },
    gstRate: product.gstRate ?? null,
    hsnCode: product.hsnCode ?? null,
    currency: 'INR',
  };
}

function allImagesForProduct(product: ProductRow): {
  productImages: string[];
  variantImages: string[];
  gallery: string[];
} {
  const productImages = dedupeStrings(toStringArray(product.images));

  const variantImages = dedupeStrings(
    (Array.isArray(product.variants) ? product.variants : []).flatMap(
      (variant) => toStringArray(variant?.images)
    )
  );

  const gallery = dedupeStrings([...productImages, ...variantImages]);

  return {
    productImages,
    variantImages,
    gallery,
  };
}

function choosePrimaryImage(product: ProductRow) {
  const preferredImage = asString(product.cataloguePreferredImage);
  const { productImages, variantImages, gallery } = allImagesForProduct(product);

  if (preferredImage) {
    return {
      preferredImage,
      primaryImage: preferredImage,
      productImages,
      variantImages,
      gallery,
      selectionMode: 'preferred_override',
      selectionSource: gallery.includes(preferredImage)
        ? 'gallery'
        : 'external_override',
      usedFallback: false,
    };
  }

  if (productImages.length > 0) {
    return {
      preferredImage: null,
      primaryImage: productImages[0],
      productImages,
      variantImages,
      gallery,
      selectionMode: 'product_gallery',
      selectionSource: 'product_images',
      usedFallback: false,
    };
  }

  if (variantImages.length > 0) {
    return {
      preferredImage: null,
      primaryImage: variantImages[0],
      productImages,
      variantImages,
      gallery,
      selectionMode: 'variant_fallback',
      selectionSource: 'variant_images',
      usedFallback: true,
    };
  }

  return {
    preferredImage,
    primaryImage: null,
    productImages,
    variantImages,
    gallery,
    selectionMode: 'none',
    selectionSource: 'none',
    usedFallback: false,
  };
}

function buildMedia(product: ProductRow) {
  const imageApproved = !!product.catalogueImageApproved;
  const imageQualityScore = product.catalogueImageQualityScore ?? null;
  const chosen = choosePrimaryImage(product);

  const approvedGallery = imageApproved ? chosen.gallery : [];
  const approvedPrimaryImage =
    imageApproved && chosen.primaryImage ? chosen.primaryImage : null;

  return {
    primaryImage: chosen.primaryImage,
    approvedPrimaryImage,
    preferredImage: chosen.preferredImage,
    gallery: chosen.gallery,
    approvedGallery,
    productImages: chosen.productImages,
    variantImages: chosen.variantImages,
    video: asString(product.video),
    imageApproved,
    imageQualityScore,
    selectionMode: chosen.selectionMode,
    selectionSource: chosen.selectionSource,
    fallbackApplied: chosen.usedFallback,
    hasMedia: chosen.gallery.length > 0 || !!chosen.primaryImage,
    hasApprovedMedia: approvedGallery.length > 0 || !!approvedPrimaryImage,
  };
}

function deriveStock(product: ProductRow) {
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
    showExactQuantity: stockVisibility === 'SHOW_ALL',
    label,
    purchasable: inStock,
  };
}

function buildHierarchy(category: CategoryNode) {
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

  let current: CategoryNode = category;

  while (current) {
    lineage.push({
      id: current.id,
      name: current.name,
      slug: current.slug,
      path: current.path ?? null,
      level: typeof current.level === 'number' ? current.level : null,
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

function buildCatalogueReadiness(
  product: ProductRow,
  media: ReturnType<typeof buildMedia>,
  pricing: ReturnType<typeof buildPricing>,
  stock: ReturnType<typeof deriveStock>
) {
  const blockers: string[] = [];

  if (product.status !== 'ACTIVE') {
    blockers.push('inactive_status');
  }

  if (!!product.catalogueExclude) {
    blockers.push('excluded_from_catalogue');
  }

  if (!media.primaryImage) {
    blockers.push('missing_primary_image');
  }

  if (!media.imageApproved) {
    blockers.push('image_not_approved');
  }

  if (!media.approvedPrimaryImage) {
    blockers.push('missing_approved_primary_image');
  }

  if (
    typeof pricing.effectivePrice !== 'number' ||
    !Number.isFinite(pricing.effectivePrice) ||
    pricing.effectivePrice <= 0
  ) {
    blockers.push('invalid_effective_price');
  }

  if (!stock.inStock && stock.stockVisibility === 'IN_STOCK_ONLY') {
    blockers.push('hidden_by_stock_rule');
  }

  return {
    readyForCatalogue: blockers.length === 0,
    visibleInFeed: product.status === 'ACTIVE' && !product.catalogueExclude,
    usesApprovedMedia: !!media.imageApproved && !!media.approvedPrimaryImage,
    blockers,
  };
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

function buildPublicVisibilityWhere() {
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

function mapCatalogueProduct(product: ProductRow, now: Date) {
  const hierarchy = buildHierarchy(product.category);
  const media = buildMedia(product);
  const pricing = buildPricing(product, now);
  const stock = deriveStock(product);
  const readiness = buildCatalogueReadiness(product, media, pricing, stock);

  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    sellerId: product.sellerId ?? null,

    title: product.name,
    name: product.name,
    shortName: product.shortName ?? null,
    poeticLine: product.poeticLine ?? null,

    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
          path: product.category.path ?? null,
          level: product.category.level ?? null,
          parentId: product.category.parentId ?? null,
          breadcrumb: hierarchy.breadcrumb,
          breadcrumbSlugs: hierarchy.breadcrumbSlugs,
        }
      : null,

    hierarchy,

    media,

    pricing,

    stock,

    editorial: {
      featured: !!product.catalogueFeatured,
      bestseller: !!product.catalogueBestseller,
      editorial: !!product.catalogueEditorial,
      pinHero: !!product.cataloguePinHero,
      exclude: !!product.catalogueExclude,
      audienceTag: product.catalogueAudienceTag || null,
      ctaMode: product.catalogueCtaMode || null,
      storyBlock: product.catalogueStoryBlock || null,
    },

    content: {
      description: product.description || null,
      story: product.story || null,
      craftNote: product.craftNote || null,
      careInstructions: product.careInstructions || null,
      sustainabilityNote: product.sustainabilityNote || null,
    },

    attributes: {
      craft: product.craft || null,
      region: product.region || null,
      state: product.state || null,
      cluster: product.cluster || null,
      artisanName: product.artisanName || null,
      material: product.material || null,
      technique: product.technique || null,
      occasion: product.occasion || null,
      badges: toStringArray(product.badges),
    },

    commerce: {
      status: product.status,
      codEligible: !!product.codEligible,
      returnEligible: !!product.returnEligible,
      returnPolicy: product.returnPolicy || null,
      fulfilmentMode: product.fulfilmentMode || null,
      depositPercent: product.depositPercent ?? null,
      releaseDate: product.releaseDate ?? null,
      editionSize: product.editionSize ?? null,
      editionSold: product.editionSold ?? null,
    },

    ai: {
      aiTryOnEligible: !!product.aiTryOnEligible,
      aiRoomEligible: !!product.aiRoomEligible,
      arTryOnEligible: !!product.arTryOnEligible,
    },

    selection: {
      preferredImageApplied: media.selectionMode === 'preferred_override',
      usedVariantImageFallback: media.selectionMode === 'variant_fallback',
      excludedFromCatalogue: !!product.catalogueExclude,
      approvedMediaOnly: true,
      stockVisibilityRule: stock.stockVisibility,
    },

    catalogueReadiness: readiness,

    variants: (product.variants || []).map((variant) => {
      const variantInventory =
        typeof variant?.inventory === 'number'
          ? variant.inventory
          : Number.parseInt(String(variant?.inventory ?? 0), 10) || 0;

      const variantMrp =
        typeof variant?.mrp === 'number' ? variant.mrp : null;

      const variantSellingPrice =
        typeof variant?.sellingPrice === 'number'
          ? variant.sellingPrice
          : null;

      return {
        id: variant.id,
        sku: variant.sku,
        size: variant.size ?? null,
        color: variant.color ?? null,
        colorHex: variant.colorHex ?? null,
        material: variant.material ?? null,
        inventory: variantInventory,
        lowStockThreshold: variant.lowStockThreshold ?? null,
        images: toStringArray(variant.images),
        mrp: variantMrp,
        sellingPrice: variantSellingPrice,
        inStock: variantInventory > 0,
      };
    }),

    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);

    const categoryParam =
      url.searchParams.get('category') ||
      url.searchParams.get('slug') ||
      '';

    const search =
      asString(url.searchParams.get('q')) ||
      asString(url.searchParams.get('search')) ||
      '';

    const audience = asString(url.searchParams.get('audience'));
    const includeExcluded = truthyParam(
      url.searchParams.get('includeExcluded')
    );
    const featuredOnly = truthyParam(url.searchParams.get('featured'));
    const heroOnly = truthyParam(url.searchParams.get('hero'));
    const readyOnly =
      truthyParam(url.searchParams.get('ready')) ||
      truthyParam(url.searchParams.get('catalogueReady'));

    const publicOnly = truthyParam(url.searchParams.get('publicOnly'));
    const approvedMediaOnly = truthyParam(
      url.searchParams.get('approvedMediaOnly')
    );

    const sort = asString(url.searchParams.get('sort')) || 'featured';

    const page = asPositiveInt(url.searchParams.get('page'), DEFAULT_PAGE);
    const limit = Math.min(
      asPositiveInt(url.searchParams.get('limit'), DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const skip = (page - 1) * limit;

    const categoryResolution = await resolveCategoryFilter(categoryParam);

    const andClauses: any[] = [{ status: 'ACTIVE' }];

    if (Object.keys(categoryResolution.where || {}).length > 0) {
      andClauses.push(categoryResolution.where);
    }

    if (!includeExcluded) {
      andClauses.push({ catalogueExclude: false });
    }

    if (publicOnly) {
      andClauses.push(buildPublicVisibilityWhere());
    }

    if (audience) {
      andClauses.push({ catalogueAudienceTag: audience });
    }

    if (featuredOnly) {
      andClauses.push({ catalogueFeatured: true });
    }

    if (heroOnly) {
      andClauses.push({ cataloguePinHero: true });
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

    const where =
      andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

    const now = new Date();
    const orderBy = buildOrderBy(sort);
    const include = buildInclude();

    const productsRaw = (await prisma.product.findMany({
      where,
      orderBy,
      include,
    })) as ProductRow[];

    let items = productsRaw.map((product) => mapCatalogueProduct(product, now));

    if (approvedMediaOnly) {
      items = items.filter((item) => item.media.hasApprovedMedia);
    }

    if (readyOnly) {
      items = items.filter((item) => item.catalogueReadiness.readyForCatalogue);
    }

    const total = items.length;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
    const pagedItems = items.slice(skip, skip + limit);

    const response = NextResponse.json({
      ok: true,
      readModel: {
        version: READ_MODEL_VERSION,
        generatedAt: now.toISOString(),
        approvedMediaRequired: true,
        supportedStockVisibility: CANONICAL_STOCK_VISIBILITY,
      },
      filters: {
        category: categoryParam || null,
        search: search || null,
        audience,
        includeExcluded,
        featuredOnly,
        heroOnly,
        readyOnly,
        publicOnly,
        approvedMediaOnly,
        sort,
      },
      matchedCategory: categoryResolution.matchedCategory,
      matchMode: categoryResolution.matchMode,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      count: pagedItems.length,
      totalCount: total,
      items: pagedItems,
      products: pagedItems,
    });

    response.headers.set('x-read-model-version', READ_MODEL_VERSION);
    response.headers.set(
      'x-supported-stock-visibility',
      CANONICAL_STOCK_VISIBILITY.join(',')
    );

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        items: [],
        products: [],
        count: 0,
        totalCount: 0,
        error: error?.message || 'Failed to load catalog products',
      },
      { status: 500 }
    );
  }
}
