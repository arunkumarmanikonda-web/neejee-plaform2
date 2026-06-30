import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const READ_MODEL_VERSION = 'phase1.categories.v2';

const CANONICAL_STOCK_VISIBILITY = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

type CanonicalStockVisibility =
  (typeof CANONICAL_STOCK_VISIBILITY)[number];

type ParentCategoryRow = {
  id: string;
  name: string;
  slug: string;
  path: string | null;
  level: number;
  parentId: string | null;
  parent: ParentCategoryRow | null;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  path: string | null;
  level: number;
  parentId: string | null;
  active: boolean;
  hidden: boolean;
  gender: string | null;
  parent: ParentCategoryRow | null;
};

type ProductRow = {
  categoryId: string | null;
  status: string;
  catalogueExclude: boolean | null;
  catalogueStockVisibility: string | null;
  variants: Array<{
    inventory: number | null;
  }>;
};

type LineageNode = {
  id: string;
  name: string;
  slug: string;
  path: string | null;
  level: number | null;
  parentId: string | null;
};

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  const text = asString(value);
  if (!text) return null;

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function truthyParam(value: string | null): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function normalizePath(value: string | null): string | null {
  if (!value) return null;

  const normalized = value
    .split('/')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join('/');

  return normalized || null;
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
  const stockVisibility = normalizeStockVisibility(
    product.catalogueStockVisibility
  );
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

function buildLineage(category: CategoryRow) {
  const lineage: LineageNode[] = [];

  let current: CategoryRow | ParentCategoryRow | null = category;

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

    const q =
      asString(searchParams.get('q')) ||
      asString(searchParams.get('search'));

    const slugFilter = asString(searchParams.get('slug'))?.toLowerCase() ?? null;
    const pathFilter = normalizePath(asString(searchParams.get('path')));
    const parentIdFilter = asString(searchParams.get('parentId'));
    const levelFilter = asInt(searchParams.get('level'));
    const rootOnly = truthyParam(searchParams.get('rootOnly'));
    const leafOnly = truthyParam(searchParams.get('leafOnly'));

    const categories = await prisma.category.findMany({
      orderBy: [{ level: 'asc' }, { order: 'asc' }, { name: 'asc' }],
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
      },
    });

    const typedCategories = categories as CategoryRow[];

    const categoryMap = new Map<string, CategoryRow>();
    const childCountMap = new Map<string, number>();

    for (const category of typedCategories) {
      categoryMap.set(category.id, category);

      if (category.parentId) {
        childCountMap.set(
          category.parentId,
          (childCountMap.get(category.parentId) ?? 0) + 1
        );
      }
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

        let current: CategoryRow | ParentCategoryRow | null = category;

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

          current = current.parent ?? null;
        }
      }
    }

    const mapped = typedCategories.map((category) => {
      const hierarchy = buildLineage(category);
      const childCount = childCountMap.get(category.id) ?? 0;

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

        isRoot: !category.parentId,
        isLeaf: childCount === 0,
        directChildCount: childCount,

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
      if (slugFilter && category.slug.toLowerCase() !== slugFilter) {
        return false;
      }

      if (
        pathFilter &&
        normalizePath(category.path ?? null) !== pathFilter
      ) {
        return false;
      }

      if (parentIdFilter && category.parentId !== parentIdFilter) {
        return false;
      }

      if (
        typeof levelFilter === 'number' &&
        category.level !== levelFilter
      ) {
        return false;
      }

      if (rootOnly && !category.isRoot) {
        return false;
      }

      if (leafOnly && !category.isLeaf) {
        return false;
      }

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
        version: READ_MODEL_VERSION,
        generatedAt: new Date().toISOString(),
        supportedStockVisibility: CANONICAL_STOCK_VISIBILITY,
        includeCounts,
        filters: {
          visible: mode ?? null,
          q: q ?? null,
          slug: slugFilter,
          path: pathFilter,
          parentId: parentIdFilter ?? null,
          level: levelFilter,
          rootOnly,
          leafOnly,
        },
      },
      categories: filtered,
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
        categories: [],
        error: e?.message || 'Failed to load categories',
      },
      { status: 500 }
    );
  }
}
