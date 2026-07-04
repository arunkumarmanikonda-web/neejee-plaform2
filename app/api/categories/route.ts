import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildCatalogueReadiness,
  buildMedia,
  buildPricing,
  deriveStock,
  type ProductReadSourceRow,
} from '@/lib/catalog/product-read';
import {
  CATALOGUE_STOCK_VISIBILITY,
  PRODUCT_READ_MODEL_VERSION,
} from '@/lib/catalog/contracts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROUTE_READ_MODEL_VERSION = 'phase1.categories.v3';

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

type CategoryProductRow = Pick<
  ProductReadSourceRow,
  | 'id'
  | 'slug'
  | 'sku'
  | 'status'
  | 'name'
  | 'mrp'
  | 'sellingPrice'
  | 'salePrice'
  | 'saleStartsAt'
  | 'saleEndsAt'
  | 'images'
  | 'catalogueExclude'
  | 'cataloguePreferredImage'
  | 'catalogueImageApproved'
  | 'catalogueImageQualityScore'
  | 'catalogueStockVisibility'
  | 'createdAt'
  | 'updatedAt'
  | 'variants'
> & {
  categoryId: string | null;
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

function buildProductVisibility(product: CategoryProductRow, now = new Date()) {
  const media = buildMedia(product);
  const pricing = buildPricing(product, now);
  const stock = deriveStock(product);
  const readiness = buildCatalogueReadiness(product, media, pricing, stock);

  const visibleInCatalogue =
    product.status === 'ACTIVE' &&
    !product.catalogueExclude &&
    (stock.stockVisibility === 'IN_STOCK_ONLY' ? stock.inStock : true);

  return {
    inStock: stock.inStock,
    stockVisibility: stock.stockVisibility,
    visibleInCatalogue,
    readyForCatalogue: readiness.readyForCatalogue,
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
          id: true,
          slug: true,
          sku: true,
          name: true,
          categoryId: true,
          status: true,
          catalogueExclude: true,
          catalogueStockVisibility: true,
          catalogueImageApproved: true,
          catalogueImageQualityScore: true,
          cataloguePreferredImage: true,
          images: true,
          mrp: true,
          sellingPrice: true,
          salePrice: true,
          saleStartsAt: true,
          saleEndsAt: true,
          createdAt: true,
          updatedAt: true,
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
          },
        },
      });

      const now = new Date();

      for (const product of products as unknown as CategoryProductRow[]) {
        if (!product.categoryId) continue;

        const category = categoryMap.get(product.categoryId);
        if (!category) continue;

        const visibility = buildProductVisibility(product, now);

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
      if (slugFilter && category.slug.toLowerCase() !== slugFilter) return false;
      if (pathFilter && normalizePath(category.path ?? null) !== pathFilter) return false;
      if (parentIdFilter && category.parentId !== parentIdFilter) return false;
      if (typeof levelFilter === 'number' && category.level !== levelFilter) return false;
      if (rootOnly && !category.isRoot) return false;
      if (leafOnly && !category.isLeaf) return false;

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

        if (!haystack.includes(q.toLowerCase())) return false;
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
        version: ROUTE_READ_MODEL_VERSION,
        canonicalVersion: PRODUCT_READ_MODEL_VERSION,
        generatedAt: new Date().toISOString(),
        supportedStockVisibility: CATALOGUE_STOCK_VISIBILITY,
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

    response.headers.set('x-read-model-version', ROUTE_READ_MODEL_VERSION);
    response.headers.set('x-canonical-read-model-version', PRODUCT_READ_MODEL_VERSION);
    response.headers.set(
      'x-supported-stock-visibility',
      CATALOGUE_STOCK_VISIBILITY.join(',')
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
