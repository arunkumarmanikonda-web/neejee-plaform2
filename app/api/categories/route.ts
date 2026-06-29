import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
  categoryId: string | null;
  status: string;
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

function truthyParam(value: string | null): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
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

function buildProductVisibility(product: ProductRow) {
  const inStock = totalInventory(product) > 0;
  const stockVisibility = normalizeStockVisibility(product.catalogueStockVisibility);
  const visibleByStock =
    stockVisibility === 'IN_STOCK_ONLY' ? inStock : true;

  const visibleInCatalogue =
    product.status === 'ACTIVE' &&
    !product.catalogueExclude &&
    visibleByStock;

  return {
    inStock,
    stockVisibility,
    visibleInCatalogue,
  };
}

function buildLineage(category: any) {
  const lineage: Array<{
    id: string;
    name: string;
    slug: string;
    path: string | null;
    level: number | null;
    parentId: string | null;
  }> = [];

  let current: any = category;

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
    mainCategory: lineage[0] ?? null,
    subCategory: lineage[1] ?? null,
    subSubCategory: lineage[2] ?? null,
    leafCategory: lineage[lineage.length - 1] ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get('visible');
    const visibleOnly = mode === 'true';
    const previewVisible = mode === 'preview';
    const includeCounts = searchParams.get('counts') !== 'false';
    const q = asString(searchParams.get('q')) || asString(searchParams.get('search'));

    const categories = await prisma.category.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        path: true,
        level: true,
        parentId: true,
        active: true,
        hidden: true,
        gender: true,
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
    });

    const categoryMap = new Map<string, any>();
    for (const category of categories) {
      categoryMap.set(category.id, category);
    }

    const directVisibleCounts = new Map<string, number>();
    const descendantVisibleCounts = new Map<string, number>();
    const directInStockCounts = new Map<string, number>();
    const descendantInStockCounts = new Map<string, number>();

    if (includeCounts) {
      const products = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          categoryId: true,
          status: true,
          catalogueExclude: true,
          catalogueStockVisibility: true,
          variants: {
            select: {
              inventory: true,
            },
          },
        },
      });

      for (const product of products as ProductRow[]) {
        if (!product.categoryId) continue;

        const category = categoryMap.get(product.categoryId);
        if (!category) continue;

        const visibility = buildProductVisibility(product);

        if (visibility.visibleInCatalogue) {
          directVisibleCounts.set(
            category.id,
            (directVisibleCounts.get(category.id) ?? 0) + 1
          );
        }

        if (visibility.inStock) {
          directInStockCounts.set(
            category.id,
            (directInStockCounts.get(category.id) ?? 0) + 1
          );
        }

        let current: any = category;
        while (current) {
          if (visibility.visibleInCatalogue) {
            descendantVisibleCounts.set(
              current.id,
              (descendantVisibleCounts.get(current.id) ?? 0) + 1
            );
          }

          if (visibility.inStock) {
            descendantInStockCounts.set(
              current.id,
              (descendantInStockCounts.get(current.id) ?? 0) + 1
            );
          }

          current = current.parentId ? categoryMap.get(current.parentId) : null;
        }
      }
    }

    const mapped = categories.map((category) => {
      const hierarchy = buildLineage(category);

      return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        path: category.path ?? null,
        level: category.level ?? null,
        parentId: category.parentId ?? null,
        active: !!category.active,
        hidden: !!category.hidden,
        gender: category.gender ?? null,

        breadcrumb: hierarchy.breadcrumb,
        breadcrumbSlugs: hierarchy.breadcrumbSlugs,
        lineage: hierarchy.lineage,
        mainCategory: hierarchy.mainCategory,
        subCategory: hierarchy.subCategory,
        subSubCategory: hierarchy.subSubCategory,
        leafCategory: hierarchy.leafCategory,

        directVisibleProductCount: directVisibleCounts.get(category.id) ?? 0,
        descendantVisibleProductCount:
          descendantVisibleCounts.get(category.id) ?? 0,
        directInStockProductCount: directInStockCounts.get(category.id) ?? 0,
        descendantInStockProductCount:
          descendantInStockCounts.get(category.id) ?? 0,
      };
    });

    const filtered = mapped.filter((category) => {
      if (q) {
        const haystack = [
          category.name,
          category.slug,
          category.path,
          ...(category.breadcrumb || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(q.toLowerCase())) {
          return false;
        }
      }

      if (visibleOnly) {
        return (
          category.active &&
          !category.hidden &&
          category.descendantVisibleProductCount > 0
        );
      }

      if (previewVisible) {
        return category.active && !category.hidden;
      }

      return true;
    });

    const response = NextResponse.json({
      ok: true,
      readModel: {
        version: 'phase1.categories.v1',
        generatedAt: new Date().toISOString(),
        supportedStockVisibility: CANONICAL_STOCK_VISIBILITY,
        includeCounts,
      },
      categories: filtered,
    });

    response.headers.set('x-read-model-version', 'phase1.categories.v1');
    response.headers.set(
      'x-supported-stock-visibility',
      CANONICAL_STOCK_VISIBILITY.join(',')
    );

    return response;
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        categories: [],
        error: e?.message || 'Failed to load categories',
      },
      { status: 500 }
    );
  }
}
