import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeTree } from '@/lib/taxonomy/normalize';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CANONICAL_STOCK_VISIBILITY = [
  'IN_STOCK_ONLY',
  'SHOW_ALL',
  'HIDE_STOCK',
] as const;

type CanonicalStockVisibility =
  (typeof CANONICAL_STOCK_VISIBILITY)[number];

type CatRow = {
  id: string;
  slug: string;
  name: string;
  level: number;
  path: string | null;
  parentId: string | null;
  active: boolean;
  hidden: boolean;
};

type ProductRow = {
  id: string;
  categoryId: string | null;
  status: string;
  catalogueExclude: boolean | null;
  catalogueStockVisibility: string | null;
  catalogueImageApproved: boolean | null;
  cataloguePreferredImage: string | null;
  images: unknown;
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  variants: Array<{
    inventory: number | null;
    images: unknown;
  }>;
};

type Node = CatRow & {
  children: Node[];
  directSellableCount: number;
  descendantSellableCount: number;
  directVisibleProductCount: number;
  descendantVisibleProductCount: number;
  directReadyProductCount: number;
  descendantReadyProductCount: number;
  directInStockProductCount: number;
  descendantInStockProductCount: number;
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

function countInventory(product: ProductRow): number {
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

function choosePrimaryImage(product: ProductRow): string | null {
  const preferredImage = asString(product.cataloguePreferredImage);

  const productImages = dedupeStrings(toStringArray(product.images));
  const variantImages = dedupeStrings(
    (Array.isArray(product.variants) ? product.variants : []).flatMap(
      (variant) => toStringArray(variant?.images)
    )
  );

  if (preferredImage) return preferredImage;
  if (productImages.length > 0) return productImages[0];
  if (variantImages.length > 0) return variantImages[0];

  return null;
}

function buildProductState(product: ProductRow, now = new Date()) {
  const totalInventory = countInventory(product);
  const stockVisibility = normalizeStockVisibility(
    product.catalogueStockVisibility
  );
  const inStock = totalInventory > 0;
  const excluded = !!product.catalogueExclude;
  const active = product.status === 'ACTIVE';

  const visibleByStock =
    stockVisibility === 'IN_STOCK_ONLY' ? inStock : true;

  const visibleInTree = active && !excluded && visibleByStock;

  const primaryImage = choosePrimaryImage(product);
  const approvedImageReady =
    !!product.catalogueImageApproved && !!primaryImage;

  const priceReady = effectivePrice(product, now) > 0;

  const readyForCatalogue =
    visibleInTree && approvedImageReady && priceReady;

  return {
    totalInventory,
    inStock,
    stockVisibility,
    visibleInTree,
    readyForCatalogue,
  };
}

function buildTree(rows: CatRow[]): Node[] {
  const map = new Map<string, Node>();

  rows.forEach((row) => {
    map.set(row.id, {
      ...row,
      children: [],
      directSellableCount: 0,
      descendantSellableCount: 0,
      directVisibleProductCount: 0,
      descendantVisibleProductCount: 0,
      directReadyProductCount: 0,
      descendantReadyProductCount: 0,
      directInStockProductCount: 0,
      descendantInStockProductCount: 0,
    });
  });

  const roots: Node[] = [];

  for (const node of map.values()) {
    if (!node.parentId || !map.has(node.parentId)) {
      if (node.level === 1 || !node.parentId) {
        roots.push(node);
      }
    } else {
      map.get(node.parentId)!.children.push(node);
    }
  }

  return roots;
}

function sumCounts(node: Node) {
  let visibleTotal = node.directVisibleProductCount;
  let readyTotal = node.directReadyProductCount;
  let inStockTotal = node.directInStockProductCount;

  for (const child of node.children) {
    sumCounts(child);
    visibleTotal += child.descendantVisibleProductCount;
    readyTotal += child.descendantReadyProductCount;
    inStockTotal += child.descendantInStockProductCount;
  }

  node.descendantVisibleProductCount = visibleTotal;
  node.descendantReadyProductCount = readyTotal;
  node.descendantInStockProductCount = inStockTotal;

  // Backward-compatible aliases for existing consumers
  node.directSellableCount = node.directVisibleProductCount;
  node.descendantSellableCount = node.descendantVisibleProductCount;
}

function filterPublic(nodes: Node[]): Node[] {
  function keep(node: Node): Node | null {
    if (node.level === 1) {
      if (!node.active || node.hidden) return null;
      return {
        ...node,
        children: node.children.map(keep).filter(Boolean) as Node[],
      };
    }

    const visibleChildren = node.children.map(keep).filter(Boolean) as Node[];
    const branchVisible =
      node.directVisibleProductCount > 0 || visibleChildren.length > 0;

    if (!node.active || node.hidden || !branchVisible) return null;

    return {
      ...node,
      children: visibleChildren,
    };
  }

  return nodes.map(keep).filter(Boolean) as Node[];
}

function filterPreview(nodes: Node[]): Node[] {
  const keep = (node: Node): Node | null => {
    if (!node.active || node.hidden) return null;

    const previewChildren = node.children.map(keep).filter(Boolean) as Node[];

    return {
      ...node,
      children: previewChildren,
    };
  };

  return nodes.map(keep).filter(Boolean) as Node[];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('visible');
    const visibleOnly = mode === 'true';
    const previewVisible = mode === 'preview';

    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          level: true,
          path: true,
          parentId: true,
          active: true,
          hidden: true,
        },
      }),
      prisma.product.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          categoryId: true,
          status: true,
          catalogueExclude: true,
          catalogueStockVisibility: true,
          catalogueImageApproved: true,
          cataloguePreferredImage: true,
          images: true,
          mrp: true,
          sellingPrice: true,
          salePrice: true,
          saleStartsAt: true,
          saleEndsAt: true,
          variants: {
            select: {
              inventory: true,
              images: true,
            },
          },
        },
      }),
    ]);

    const tree = buildTree(categories as CatRow[]);
    const nodeMap = new Map<string, Node>();

    const indexNodes = (nodes: Node[]) => {
      for (const node of nodes) {
        nodeMap.set(node.id, node);
        indexNodes(node.children);
      }
    };

    indexNodes(tree);

    const now = new Date();

    for (const product of products as ProductRow[]) {
      if (!product.categoryId) continue;

      const node = nodeMap.get(product.categoryId);
      if (!node) continue;

      const state = buildProductState(product, now);

      if (state.visibleInTree) {
        node.directVisibleProductCount += 1;
      }

      if (state.readyForCatalogue) {
        node.directReadyProductCount += 1;
      }

      if (state.inStock) {
        node.directInStockProductCount += 1;
      }
    }

    for (const root of tree) {
      sumCounts(root);
    }

    const normalizedFullTree = normalizeTree(tree as any) as Node[];

    const output = visibleOnly
      ? (normalizeTree(filterPublic(normalizedFullTree as any) as any) as Node[])
      : previewVisible
        ? (normalizeTree(filterPreview(normalizedFullTree as any) as any) as Node[])
        : normalizedFullTree;

    const response = NextResponse.json(output);
    response.headers.set('x-read-model-version', 'phase1.category-tree.v1');
    response.headers.set('x-generated-at', now.toISOString());
    response.headers.set(
      'x-supported-stock-visibility',
      CANONICAL_STOCK_VISIBILITY.join(',')
    );

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to build category tree',
      },
      { status: 500 }
    );
  }
}
