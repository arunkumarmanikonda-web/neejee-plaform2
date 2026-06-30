﻿// Public products list endpoint - used by PLP, homepage carousels, search
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const CANONICAL_STOCK_VISIBILITY = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

type CanonicalStockVisibility =
  (typeof CANONICAL_STOCK_VISIBILITY)[number];

function normalizeText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeStockVisibility(
  value: unknown
): CanonicalStockVisibility {
  const raw = normalizeText(value)?.toUpperCase();

  if (!raw) return 'IN_STOCK_ONLY';
  if (raw === 'SHOW_ALL' || raw === 'SHOW_EXACT') return 'SHOW_ALL';
  if (raw === 'HIDE_STOCK') return 'HIDE_STOCK';
  if (raw === 'LOW_STOCK_BADGE' || raw === 'IN_STOCK_ONLY') return 'IN_STOCK_ONLY';

  return 'IN_STOCK_ONLY';
}

function isSaleLive(product: any, now = new Date()): boolean {
  const salePrice =
    typeof product?.salePrice === 'number'
      ? product.salePrice
      : Number.parseInt(String(product?.salePrice ?? ''), 10);

  const sellingPrice =
    typeof product?.sellingPrice === 'number'
      ? product.sellingPrice
      : Number.parseInt(String(product?.sellingPrice ?? ''), 10);

  if (!Number.isFinite(salePrice) || salePrice <= 0) return false;
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return false;
  if (salePrice >= sellingPrice) return false;

  const startsAt = product?.saleStartsAt ? new Date(product.saleStartsAt) : null;
  const endsAt = product?.saleEndsAt ? new Date(product.saleEndsAt) : null;

  if (startsAt && Number.isNaN(startsAt.getTime())) return false;
  if (endsAt && Number.isNaN(endsAt.getTime())) return false;

  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;

  return true;
}

function buildPricing(product: any, now = new Date()) {
  const mrp =
    typeof product?.mrp === 'number'
      ? product.mrp
      : Number.parseInt(String(product?.mrp ?? 0), 10) || 0;

  const sellingPrice =
    typeof product?.sellingPrice === 'number'
      ? product.sellingPrice
      : Number.parseInt(String(product?.sellingPrice ?? 0), 10) || 0;

  const liveSale = isSaleLive(product, now);
  const parsedSalePrice =
    typeof product?.salePrice === 'number'
      ? product.salePrice
      : Number.parseInt(String(product?.salePrice ?? 0), 10) || 0;

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
    saleStartsAt: product?.saleStartsAt ?? null,
    saleEndsAt: product?.saleEndsAt ?? null,
  };
}

function chooseImages(product: any) {
  const preferredImage = normalizeText(product?.cataloguePreferredImage);

  const productImages = dedupeStrings(toStringArray(product?.images));
  const variantImages = dedupeStrings(
    (Array.isArray(product?.variants) ? product.variants : []).flatMap((variant: any) =>
      toStringArray(variant?.images)
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
    imageApproved: !!product?.catalogueImageApproved,
    imageQualityScore: product?.catalogueImageQualityScore ?? null,
  };
}

function buildStock(product: any) {
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

  const stockVisibility = normalizeStockVisibility(
    product?.catalogueStockVisibility
  );

  const inStock = totalInventory > 0;
  const availableQuantity = stockVisibility === 'SHOW_ALL' ? totalInventory : null;

  let label = 'Out of stock';
  let visibleInListing = true;

  if (stockVisibility === 'HIDE_STOCK') {
    label = inStock ? 'Available' : 'Unavailable';
    visibleInListing = true;
  } else if (stockVisibility === 'SHOW_ALL') {
    label = inStock ? `${totalInventory} available` : 'Out of stock';
    visibleInListing = true;
  } else {
    label = inStock ? (lowStock ? 'Low stock' : 'In stock') : 'Out of stock';
    visibleInListing = inStock;
  }

  return {
    inStock,
    totalInventory,
    lowStock,
    stockVisibility,
    availableQuantity,
    label,
    visibleInListing,
  };
}

function splitPath(pathValue: unknown): string[] {
  const path = normalizeText(pathValue);
  if (!path) return [];
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildOrderBy(sort: string) {
  if (sort === 'price_asc') return [{ sellingPrice: 'asc' as const }];
  if (sort === 'price_desc') return [{ sellingPrice: 'desc' as const }];
  if (sort === 'name') return [{ name: 'asc' as const }];

  return [
    { cataloguePinHero: 'desc' as const },
    { catalogueFeatured: 'desc' as const },
    { catalogueBestseller: 'desc' as const },
    { updatedAt: 'desc' as const },
  ];
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const category = url.searchParams.get('category');
  const search = url.searchParams.get('q');
  const craft = url.searchParams.get('craft');
  const region = url.searchParams.get('region');
  const material = url.searchParams.get('material');
  const occasion = url.searchParams.get('occasion');
  const badge = url.searchParams.get('badge');
  const audience = url.searchParams.get('audience');
  const minPriceRupees = url.searchParams.get('minPrice');
  const maxPriceRupees = url.searchParams.get('maxPrice');
  const sort = url.searchParams.get('sort') || 'newest';
  const featured = url.searchParams.get('featured');
  const arEligible = url.searchParams.get('arEligible');
  const mirrorEligible = url.searchParams.get('mirrorEligible');
  const limit = Math.min(
    parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT,
    MAX_LIMIT
  );

  try {
    let matched: any = null;
    const andClauses: any[] = [
      { status: 'ACTIVE' },
      { catalogueExclude: false },
    ];

    if (category) {
      const r = await resolveCategoryWhere(category);
      matched = r.matchedCategory;
      andClauses.push(r.where);
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
      if (minPriceRupees) priceWhere.gte = parseInt(minPriceRupees, 10) * 100;
      if (maxPriceRupees) priceWhere.lte = parseInt(maxPriceRupees, 10) * 100;
      andClauses.push({ sellingPrice: priceWhere });
    }

    if (arEligible === 'true') {
      andClauses.push({ arTryOnEligible: true });
    }

    if (mirrorEligible === 'true') {
      andClauses.push({ aiTryOnEligible: true });
    }

    if (featured === 'founder') {
      andClauses.push({ badges: { has: "FOUNDER'S EDIT" } });
    }

    if (featured === 'sale') {
      andClauses.push({ salePrice: { not: null } });
      andClauses.push({
        OR: [
          { saleStartsAt: null },
          { saleStartsAt: { lte: new Date() } },
        ],
      });
      andClauses.push({
        OR: [
          { saleEndsAt: null },
          { saleEndsAt: { gte: new Date() } },
        ],
      });
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

    const where =
      andClauses.length === 1
        ? andClauses[0]
        : { AND: andClauses };

    const products = await prisma.product.findMany({
      where,
      take: limit,
      orderBy: buildOrderBy(sort),
      include: {
        category: {
          select: {
            slug: true,
            name: true,
            path: true,
            level: true,
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
    });

    const now = new Date();

    const mapped = products
      .map((p: any) => {
        const media = chooseImages(p);
        const pricing = buildPricing(p, now);
        const stock = buildStock(p);

        return {
          id: p.id,
          slug: p.slug,
          sku: p.sku,
          name: p.name,
          shortName: p.shortName,
          poeticLine: p.poeticLine,
          craft: p.craft,
          region: p.region,

          category: p.category?.slug || null,
          categoryName: p.category?.name || null,
          categoryPath: p.category?.path || null,
          categoryLevel: p.category?.level ?? null,
          categoryBreadcrumb: splitPath(p.category?.path),

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
          imageApproved: media.imageApproved,
          imageQualityScore: media.imageQualityScore,
          imageSelectionMode: media.selectionMode,

          badges: Array.isArray(p.badges) ? p.badges : [],

          aiTryOnEligible: !!p.aiTryOnEligible,
          aiRoomEligible: !!p.aiRoomEligible,
          arTryOnEligible: !!p.arTryOnEligible,

          codEligible: p.codEligible !== false,
          returnEligible: p.returnEligible !== false,
          returnPolicy: p.returnPolicy || null,

          catalogueFeatured: !!p.catalogueFeatured,
          catalogueBestseller: !!p.catalogueBestseller,
          catalogueEditorial: !!p.catalogueEditorial,
          cataloguePinHero: !!p.cataloguePinHero,
          catalogueAudienceTag: p.catalogueAudienceTag || null,
          catalogueCtaMode: p.catalogueCtaMode || null,
          catalogueStoryBlock: p.catalogueStoryBlock || null,

          stock,
          inventory: stock.totalInventory,
          inStock: stock.inStock,
          lowStock: stock.lowStock,
        };
      })
      .filter((p) => p.stock.visibleInListing);

    return NextResponse.json({
      matchedCategory: matched,
      readModel: {
        version: 'phase1.public.products.v1',
        stockVisibility: CANONICAL_STOCK_VISIBILITY,
      },
      products: mapped,
      count: mapped.length,
    });
  } catch (e: any) {
    console.warn('[products API] DB query failed:', e.message);
    return NextResponse.json(
      {
        products: [],
        count: 0,
        error: e.message,
      },
      { status: 500 }
    );
  }
}
