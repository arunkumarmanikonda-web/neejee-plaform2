import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeTree } from '@/lib/taxonomy/normalize';
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

const ROUTE_READ_MODEL_VERSION = 'phase1.category-tree.v2';

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

type TreeProductRow = Pick<
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
    const branchVisible = node.directVisibleProductCount > 0 || visibleChildren.length > 0;

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

function buildTreeProductState(product: TreeProductRow, now = new Date()) {
  const media = buildMedia(product);
  const pricing = buildPricing(product, now);
  const stock = deriveStock(product);
  const readiness = buildCatalogueReadiness(product, media, pricing, stock);

  const visibleByStock = stock.stockVisibility === 'IN_STOCK_ONLY' ? stock.inStock : true;
  const visibleInTree = product.status === 'ACTIVE' && !product.catalogueExclude && visibleByStock;

  return {
    inStock: stock.inStock,
    visibleInTree,
    readyForCatalogue: readiness.readyForCatalogue,
  };
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

    for (const product of products as unknown as TreeProductRow[]) {
      if (!product.categoryId) continue;

      const node = nodeMap.get(product.categoryId);
      if (!node) continue;

      const state = buildTreeProductState(product, now);

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
    response.headers.set('x-read-model-version', ROUTE_READ_MODEL_VERSION);
    response.headers.set('x-canonical-read-model-version', PRODUCT_READ_MODEL_VERSION);
    response.headers.set('x-generated-at', now.toISOString());
    response.headers.set(
      'x-supported-stock-visibility',
      CATALOGUE_STOCK_VISIBILITY.join(',')
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
