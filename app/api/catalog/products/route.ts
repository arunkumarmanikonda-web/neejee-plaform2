import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function truthyParam(value: string | null): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function splitCategoryPath(pathValue: unknown): string[] {
  const path = asString(pathValue);
  if (!path) return [];
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function isSaleLive(product: any, now = new Date()): boolean {
  if (typeof product?.salePrice !== 'number') return false;

  const startsAt = product?.saleStartsAt ? new Date(product.saleStartsAt) : null;
  const endsAt = product?.saleEndsAt ? new Date(product.saleEndsAt) : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) return false;
  if (endsAt && Number.isNaN(endsAt.getTime())) return false;

  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;

  return true;
}

function allImagesForProduct(product: any): string[] {
  const base = toStringArray(product?.images);
  if (base.length > 0) {
    return Array.from(new Set<string>(base));
  }

  const fromVariants: string[] = [];
  for (const variant of product?.variants || []) {
    fromVariants.push(...toStringArray(variant?.images));
  }

  return Array.from(new Set<string>(fromVariants));
}

function choosePreferredImage(product: any, gallery: string[]): string | null {
  const preferred = asString(product?.cataloguePreferredImage);

  if (preferred && gallery.includes(preferred)) {
    return preferred;
  }

  if (gallery.length > 0) {
    return gallery[0];
  }

  return preferred || null;
}

function deriveStock(product: any) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];

  const totalInventory = variants.reduce((sum: number, variant: any) => {
    const qty =
      typeof variant?.inventory === 'number'
        ? variant.inventory
        : Number.parseInt(String(variant?.inventory ?? 0), 10) || 0;

    return sum + qty;
  }, 0);

  const lowStock = variants.some((variant: any) => {
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

  const stockVisibility = asString(product?.catalogueStockVisibility) || 'IN_STOCK_ONLY';
  const inStock = totalInventory > 0;

  let availableQuantity: number | null = null;
  let label = inStock ? 'In stock' : 'Out of stock';

  switch (stockVisibility) {
    case 'SHOW_EXACT':
      availableQuantity = totalInventory;
      label = inStock ? `${totalInventory} available` : 'Out of stock';
      break;
    case 'LOW_STOCK_BADGE':
      label = !inStock ? 'Out of stock' : lowStock ? 'Low stock' : 'In stock';
      break;
    case 'HIDE_STOCK':
      availableQuantity = null;
      label = inStock ? 'Available' : 'Unavailable';
      break;
    case 'IN_STOCK_ONLY':
    default:
      availableQuantity = null;
      label = inStock ? 'In stock' : 'Out of stock';
      break;
  }

  return {
    inStock,
    totalInventory,
    lowStock,
    stockVisibility,
    availableQuantity,
    label,
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

export async function GET(request: Request) {
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
    const includeExcluded = truthyParam(url.searchParams.get('includeExcluded'));
    const featuredOnly = truthyParam(url.searchParams.get('featured'));
    const heroOnly = truthyParam(url.searchParams.get('hero'));

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
      andClauses.length === 1
        ? andClauses[0]
        : {
            AND: andClauses,
          };

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { cataloguePinHero: 'desc' },
          { catalogueFeatured: 'desc' },
          { catalogueBestseller: 'desc' },
          { updatedAt: 'desc' },
        ],
        select: {
          id: true,
          slug: true,
          sku: true,
          sellerId: true,

          name: true,
          shortName: true,
          poeticLine: true,
          description: true,
          story: true,
          craftNote: true,
          careInstructions: true,
          sustainabilityNote: true,

          craft: true,
          region: true,
          state: true,
          cluster: true,
          artisanName: true,
          material: true,
          technique: true,
          occasion: true,

          mrp: true,
          sellingPrice: true,
          salePrice: true,
          saleStartsAt: true,
          saleEndsAt: true,
          gstRate: true,
          hsnCode: true,

          images: true,
          video: true,
          badges: true,
          status: true,

          aiTryOnEligible: true,
          aiStylistEligible: true,
          arTryOnEligible: true,
          codEligible: true,
          returnEligible: true,
          returnPolicy: true,

          fulfilmentMode: true,
          depositPercent: true,
          releaseDate: true,
          editionTotal: true,
          editionSold: true,

          catalogueFeatured: true,
          catalogueBestseller: true,
          catalogueEditorial: true,
          cataloguePinHero: true,
          catalogueExclude: true,
          cataloguePreferredImage: true,
          catalogueAudienceTag: true,
          catalogueCtaMode: true,
          catalogueStoryBlock: true,
          catalogueImageApproved: true,
          catalogueImageQualityScore: true,
          catalogueStockVisibility: true,

          createdAt: true,
          updatedAt: true,

          category: {
            select: {
              id: true,
              name: true,
              slug: true,
              path: true,
              level: true,
              parentId: true,
            },
          },

          variants: {
            select: {
              id: true,
              sku: true,
              size: true,
              color: true,
              material: true,
              inventory: true,
              lowStockThreshold: true,
              images: true,
              mrp: true,
              sellingPrice: true,
            },
            orderBy: [{ createdAt: 'asc' }],
          },
        },
      }),
    ]);

    const now = new Date();

    const items = products.map((product: any) => {
      const gallery = allImagesForProduct(product);
      const primaryImage = choosePreferredImage(product, gallery);
      const saleLive = isSaleLive(product, now);
      const stock = deriveStock(product);

      const effectivePrice =
        saleLive && typeof product.salePrice === 'number'
          ? product.salePrice
          : product.sellingPrice;

      return {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        sellerId: product.sellerId,

        title: product.name,
        name: product.name,
        shortName: product.shortName,
        poeticLine: product.poeticLine,

        category: product.category
          ? {
              id: product.category.id,
              name: product.category.name,
              slug: product.category.slug,
              path: product.category.path,
              level: product.category.level,
              parentId: product.category.parentId,
              breadcrumb: splitCategoryPath(product.category.path),
            }
          : null,

        media: {
          primaryImage,
          preferredImage: product.cataloguePreferredImage || null,
          gallery,
          video: product.video || null,
          imageApproved: !!product.catalogueImageApproved,
          imageQualityScore: product.catalogueImageQualityScore ?? null,
        },

        pricing: {
          mrp: product.mrp,
          sellingPrice: product.sellingPrice,
          salePrice: saleLive ? product.salePrice ?? null : null,
          effectivePrice,
          onSale: saleLive,
          saleStartsAt: product.saleStartsAt,
          saleEndsAt: product.saleEndsAt,
          gstRate: product.gstRate ?? null,
          hsnCode: product.hsnCode ?? null,
        },

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
          editionTotal: product.editionTotal ?? null,
          editionSold: product.editionSold ?? null,
        },

        ai: {
          aiTryOnEligible: !!product.aiTryOnEligible,
          aiStylistEligible: !!product.aiStylistEligible,
          arTryOnEligible: !!product.arTryOnEligible,
        },

        variants: (product.variants || []).map((variant: any) => ({
          id: variant.id,
          sku: variant.sku,
          size: variant.size ?? null,
          color: variant.color ?? null,
          material: variant.material ?? null,
          inventory: variant.inventory ?? 0,
          lowStockThreshold: variant.lowStockThreshold ?? null,
          images: toStringArray(variant.images),
          mrp: variant.mrp ?? null,
          sellingPrice: variant.sellingPrice ?? null,
          salePrice: null,
          inStock: (variant.inventory ?? 0) > 0,
        })),

        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    });

    return NextResponse.json({
      ok: true,
      filters: {
        category: categoryParam || null,
        search: search || null,
        audience,
        includeExcluded,
        featuredOnly,
        heroOnly,
      },
      matchedCategory: categoryResolution.matchedCategory,
      matchMode: categoryResolution.matchMode,
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
      items,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to load catalogue products',
        items: [],
      },
      { status: 500 }
    );
  }
}
