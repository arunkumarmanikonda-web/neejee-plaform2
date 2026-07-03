import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const READ_MODEL_VERSION = 'phase2.facets.v2';

const CANONICAL_STOCK_VISIBILITY = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

type CanonicalStockVisibility =
  (typeof CANONICAL_STOCK_VISIBILITY)[number];

type ProductRow = {
  craft: string | null;
  region: string | null;
  material: string | null;
  occasion: string | null;
  badges: unknown;
  catalogueAudienceTag: string | null;
  sellingPrice: number | null;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  catalogueExclude: boolean | null;
  catalogueStockVisibility: string | null;
  arTryOnEligible: boolean | null;
  aiTryOnEligible: boolean | null;
  catalogueFeatured: boolean | null;
  catalogueBestseller: boolean | null;
  catalogueEditorial: boolean | null;
  cataloguePinHero: boolean | null;
  createdAt: Date;
  variants: Array<{
    inventory: number | null;
  }>;
};

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
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

function totalInventory(product: ProductRow): number {
  return (Array.isArray(product.variants) ? product.variants : []).reduce(
    (sum, variant) => {
      const qty =
        typeof variant?.inventory === 'number'
          ? variant.inventory
          : Number.parseInt(String(variant?.inventory ?? 0), 10) || 0;

      return sum + qty;
    },
    0
  );
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

function effectivePrice(product: ProductRow, now = new Date()): number {
  const sellingPrice =
    typeof product.sellingPrice === 'number'
      ? product.sellingPrice
      : Number.parseInt(String(product.sellingPrice ?? 0), 10) || 0;

  const parsedSalePrice =
    typeof product.salePrice === 'number'
      ? product.salePrice
      : Number.parseInt(String(product.salePrice ?? 0), 10) || 0;

  if (isSaleLive(product, now) && parsedSalePrice > 0) {
    return parsedSalePrice;
  }

  return sellingPrice;
}

function buildVisibility(product: ProductRow) {
  const inStock = totalInventory(product) > 0;
  const stockVisibility = normalizeStockVisibility(
    product.catalogueStockVisibility
  );
  const visibleByStock =
    stockVisibility === 'IN_STOCK_ONLY' ? inStock : true;

  const visibleInCatalogue =
    !product.catalogueExclude && visibleByStock;

  return {
    inStock,
    stockVisibility,
    visibleInCatalogue,
  };
}

function buildPublicListingVisibilityWhere() {
  return {
    OR: [
      {
        catalogueStockVisibility: {
          in: ['SHOW_ALL', 'HIDE_STOCK'],
        },
      },
      {
        AND: [
          {
            catalogueStockVisibility: 'IN_STOCK_ONLY',
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

function isFacetLabel(s: string) {
  const t = s.trim();
  if (!t) return false;
  if (t.length > 40) return false;
  if (/[.!]/.test(t)) return false;
  const commas = (t.match(/,/g) || []).length;
  if (commas > 1) return false;
  return true;
}

function titleCase(s: string) {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function tally(values: Array<string | null>) {
  const map: Record<string, { display: string; count: number }> = {};

  for (const value of values) {
    if (!value || !isFacetLabel(value)) continue;

    const key = value.trim().toLowerCase();
    const display = titleCase(value);

    if (!map[key]) {
      map[key] = { display, count: 0 };
    }

    map[key].count += 1;
  }

  return Object.values(map)
    .map(({ display, count }) => [display, count] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}

function tallyBadges(values: string[]) {
  const map: Record<string, { display: string; count: number }> = {};

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (!map[key]) {
      map[key] = { display: trimmed, count: 0 };
    }

    map[key].count += 1;
  }

  return Object.values(map)
    .map(({ display, count }) => [display, count] as [string, number])
    .sort((a, b) => b[1] - a[1]);
}

function tallyAudience(values: Array<string | null>) {
  return tally(values);
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
  const featured = asString(url.searchParams.get('featured'));
  const arEligible = truthyParam(url.searchParams.get('arEligible'));
  const mirrorEligible = truthyParam(url.searchParams.get('mirrorEligible'));

  try {
    const andClauses: any[] = [
      { status: 'ACTIVE' },
      { catalogueExclude: false },
      buildPublicListingVisibilityWhere(),
    ];

    let matchedCategory: any = null;

    if (category) {
      const resolved = await resolveCategoryWhere(category);
      matchedCategory = resolved?.matchedCategory ?? null;

      if (resolved?.where && Object.keys(resolved.where).length > 0) {
        andClauses.push(resolved.where);
      }
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
          { occasion: { contains: search, mode: 'insensitive' } },
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
      andClauses.length === 1 ? andClauses[0] : { AND: andClauses };

    const products = (await prisma.product.findMany({
      where,
      select: {
        craft: true,
        region: true,
        material: true,
        occasion: true,
        badges: true,
        catalogueAudienceTag: true,
        sellingPrice: true,
        salePrice: true,
        saleStartsAt: true,
        saleEndsAt: true,
        catalogueExclude: true,
        catalogueStockVisibility: true,
        arTryOnEligible: true,
        aiTryOnEligible: true,
        catalogueFeatured: true,
        catalogueBestseller: true,
        catalogueEditorial: true,
        cataloguePinHero: true,
        createdAt: true,
        variants: {
          select: {
            inventory: true,
          },
        },
      },
    })) as ProductRow[];

    const visibleProducts = products.filter(
      (product) => buildVisibility(product).visibleInCatalogue
    );

    const allBadges = visibleProducts.flatMap((product) =>
      toStringArray(product.badges)
    );

    const prices = visibleProducts
      .map((product) => effectivePrice(product))
      .filter((price) => price > 0);

    const response = NextResponse.json({
      ok: true,
      readModel: {
        version: READ_MODEL_VERSION,
        generatedAt: new Date().toISOString(),
        supportedStockVisibility: CANONICAL_STOCK_VISIBILITY,
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
        arEligible,
        mirrorEligible,
      },
      matchedCategory,
      crafts: tally(visibleProducts.map((product) => product.craft)),
      regions: tally(visibleProducts.map((product) => product.region)),
      materials: tally(visibleProducts.map((product) => product.material)),
      occasions: tally(visibleProducts.map((product) => product.occasion)),
      audienceTags: tallyAudience(
        visibleProducts.map((product) => product.catalogueAudienceTag)
      ),
      badges: tallyBadges(allBadges),
      priceRange: {
        minPaise: prices.length ? Math.min(...prices) : 0,
        maxPaise: prices.length ? Math.max(...prices) : 0,
      },
      total: visibleProducts.length,
    });

    response.headers.set('x-read-model-version', READ_MODEL_VERSION);
    response.headers.set(
      'x-supported-stock-visibility',
      CANONICAL_STOCK_VISIBILITY.join(',')
    );

    return response;
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        crafts: [],
        regions: [],
        materials: [],
        occasions: [],
        audienceTags: [],
        badges: [],
        total: 0,
        priceRange: { minPaise: 0, maxPaise: 0 },
        error: e?.message || 'Failed to load facets',
      },
      { status: 500 }
    );
  }
}
