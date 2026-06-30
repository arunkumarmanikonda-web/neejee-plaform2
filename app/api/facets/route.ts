import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategoryWhere } from '@/lib/category-resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
  sellingPrice: number | null;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  catalogueExclude: boolean | null;
  catalogueStockVisibility: string | null;
  variants: Array<{
    inventory: number | null;
  }>;
};

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  try {
    const andClauses: any[] = [{ status: 'ACTIVE' }];
    let matchedCategory: any = null;

    if (category) {
      const resolved = await resolveCategoryWhere(category);
      matchedCategory = resolved?.matchedCategory ?? null;

      if (resolved?.where && Object.keys(resolved.where).length > 0) {
        andClauses.push(resolved.where);
      }
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
        sellingPrice: true,
        salePrice: true,
        saleStartsAt: true,
        saleEndsAt: true,
        catalogueExclude: true,
        catalogueStockVisibility: true,
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

    return NextResponse.json({
      ok: true,
      readModel: {
        version: 'phase2.facets.v1',
        generatedAt: new Date().toISOString(),
        supportedStockVisibility: CANONICAL_STOCK_VISIBILITY,
      },
      matchedCategory,
      crafts: tally(visibleProducts.map((product) => product.craft)),
      regions: tally(visibleProducts.map((product) => product.region)),
      materials: tally(visibleProducts.map((product) => product.material)),
      occasions: tally(visibleProducts.map((product) => product.occasion)),
      badges: tallyBadges(allBadges),
      priceRange: {
        minPaise: prices.length ? Math.min(...prices) : 0,
        maxPaise: prices.length ? Math.max(...prices) : 0,
      },
      total: visibleProducts.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        crafts: [],
        regions: [],
        materials: [],
        occasions: [],
        badges: [],
        total: 0,
        priceRange: { minPaise: 0, maxPaise: 0 },
        error: e?.message || 'Failed to load facets',
      },
      { status: 500 }
    );
  }
}
