import type {
  ErpReconciliationFilter,
  ErpReconciliationItem,
  ErpReconciliationKind,
  ErpReconciliationMismatch,
  ErpReconciliationResponse,
  ErpReconciliationRow,
  PlatformReconciliationRow,
  ReconciliationComparableStatus,
} from './contracts';
import { ERP_RECONCILIATION_VERSION } from './contracts';

type PlatformProductSource = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  status: string;
  mrp: number;
  sellingPrice: number;
  updatedAt: Date | string;
  variants: Array<{
    inventory: number;
  }>;
};

type ErpProductSource = {
  sku: string;
  name: string;
  status: string;
  updatedAt: string;
};

type ErpPriceSource = {
  mrpPaise: number;
  sellingPricePaise: number;
};

type ErpStockSource = {
  availableQuantity: number;
};

function normalizeSku(value: string): string {
  return value.trim().toUpperCase();
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function normalizePlatformStatus(status: string): ReconciliationComparableStatus {
  switch (status) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'DRAFT':
    case 'PENDING_QC':
      return 'DRAFT';
    default:
      return 'INACTIVE';
  }
}

export function normalizeReconciliationFilter(
  rawValue: string | null | undefined
): ErpReconciliationFilter {
  switch ((rawValue || '').toUpperCase()) {
    case 'MATCHED':
      return 'MATCHED';
    case 'DRIFT':
      return 'DRIFT';
    case 'MISSING_IN_ERP':
      return 'MISSING_IN_ERP';
    case 'MISSING_IN_PLATFORM':
      return 'MISSING_IN_PLATFORM';
    default:
      return 'ALL';
  }
}

export function buildPlatformReconciliationRows(
  rows: PlatformProductSource[]
): PlatformReconciliationRow[] {
  return rows
    .map((row) => ({
      productId: row.id,
      sku: normalizeSku(row.sku),
      slug: row.slug,
      name: row.name,
      status: normalizePlatformStatus(row.status),
      mrpPaise: row.mrp,
      sellingPricePaise: row.sellingPrice,
      inventoryQuantity: Array.isArray(row.variants)
        ? row.variants.reduce((sum, variant) => sum + Math.max(0, variant.inventory || 0), 0)
        : 0,
      updatedAt: toIsoString(row.updatedAt),
    }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

export function buildErpReconciliationRows(
  products: ErpProductSource[],
  pricesBySku: Record<string, ErpPriceSource | null>,
  stockBySku: Record<string, ErpStockSource | null>
): ErpReconciliationRow[] {
  return products
    .map((product) => {
      const sku = normalizeSku(product.sku);
      const price = pricesBySku[sku];
      const stock = stockBySku[sku];

      return {
        sku,
        name: product.name,
        status:
          product.status === 'ACTIVE'
            ? 'ACTIVE'
            : product.status === 'DRAFT'
            ? 'DRAFT'
            : 'INACTIVE',
        mrpPaise: price?.mrpPaise ?? 0,
        sellingPricePaise: price?.sellingPricePaise ?? 0,
        inventoryQuantity: stock?.availableQuantity ?? 0,
        updatedAt: product.updatedAt,
      } satisfies ErpReconciliationRow;
    })
    .sort((a, b) => a.sku.localeCompare(b.sku));
}

function comparePair(
  platform: PlatformReconciliationRow | null,
  erp: ErpReconciliationRow | null
): ErpReconciliationItem {
  const sku = platform?.sku ?? erp?.sku ?? 'UNKNOWN';

  if (platform && !erp) {
    return {
      sku,
      kind: 'MISSING_IN_ERP',
      mismatches: [],
      platform,
      erp: null,
    };
  }

  if (!platform && erp) {
    return {
      sku,
      kind: 'MISSING_IN_PLATFORM',
      mismatches: [],
      platform: null,
      erp,
    };
  }

  const mismatches: ErpReconciliationMismatch[] = [];

  if (platform!.status !== erp!.status) mismatches.push('STATUS');
  if (platform!.sellingPricePaise !== erp!.sellingPricePaise) mismatches.push('SELLING_PRICE');
  if (platform!.mrpPaise !== erp!.mrpPaise) mismatches.push('MRP');
  if (platform!.inventoryQuantity !== erp!.inventoryQuantity) mismatches.push('INVENTORY');

  return {
    sku,
    kind: mismatches.length > 0 ? 'DRIFT' : 'MATCHED',
    mismatches,
    platform: platform!,
    erp: erp!,
  };
}

function severity(kind: ErpReconciliationKind): number {
  switch (kind) {
    case 'MISSING_IN_ERP':
      return 1;
    case 'MISSING_IN_PLATFORM':
      return 2;
    case 'DRIFT':
      return 3;
    case 'MATCHED':
    default:
      return 4;
  }
}

export function reconcilePlatformVsErp(
  platformRows: PlatformReconciliationRow[],
  erpRows: ErpReconciliationRow[]
): ErpReconciliationItem[] {
  const platformMap = new Map(platformRows.map((row) => [row.sku, row]));
  const erpMap = new Map(erpRows.map((row) => [row.sku, row]));
  const allSkus = Array.from(new Set([...platformMap.keys(), ...erpMap.keys()])).sort();

  return allSkus
    .map((sku) => comparePair(platformMap.get(sku) ?? null, erpMap.get(sku) ?? null))
    .sort((a, b) => {
      const kindOrder = severity(a.kind) - severity(b.kind);
      if (kindOrder !== 0) return kindOrder;

      const mismatchOrder = b.mismatches.length - a.mismatches.length;
      if (mismatchOrder !== 0) return mismatchOrder;

      return a.sku.localeCompare(b.sku);
    });
}

export function filterReconciliationItems(
  items: ErpReconciliationItem[],
  filter: ErpReconciliationFilter
): ErpReconciliationItem[] {
  if (filter === 'ALL') return items;
  return items.filter((item) => item.kind === filter);
}

export function summarizeReconciliationItems(
  items: ErpReconciliationItem[]
) {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;

      if (item.kind === 'MATCHED') summary.matched += 1;
      if (item.kind === 'DRIFT') summary.drift += 1;
      if (item.kind === 'MISSING_IN_ERP') summary.missingInErp += 1;
      if (item.kind === 'MISSING_IN_PLATFORM') summary.missingInPlatform += 1;

      if (item.mismatches.includes('STATUS')) summary.statusMismatchCount += 1;
      if (item.mismatches.includes('SELLING_PRICE')) summary.sellingPriceMismatchCount += 1;
      if (item.mismatches.includes('MRP')) summary.mrpMismatchCount += 1;
      if (item.mismatches.includes('INVENTORY')) summary.inventoryMismatchCount += 1;

      return summary;
    },
    {
      total: 0,
      matched: 0,
      drift: 0,
      missingInErp: 0,
      missingInPlatform: 0,
      statusMismatchCount: 0,
      sellingPriceMismatchCount: 0,
      mrpMismatchCount: 0,
      inventoryMismatchCount: 0,
    }
  );
}

export function createErpReconciliationResponse(input: {
  generatedAt: string;
  adapterKind: string;
  filter: ErpReconciliationFilter;
  limit?: number;
  platformRows: PlatformReconciliationRow[];
  erpRows: ErpReconciliationRow[];
}): ErpReconciliationResponse {
  const allItems = reconcilePlatformVsErp(input.platformRows, input.erpRows);
  const filteredItems = filterReconciliationItems(allItems, input.filter);
  const safeLimit =
    typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0
      ? Math.floor(input.limit)
      : filteredItems.length;

  return {
    version: ERP_RECONCILIATION_VERSION,
    generatedAt: input.generatedAt,
    adapterKind: input.adapterKind,
    filter: input.filter,
    summary: summarizeReconciliationItems(allItems),
    items: filteredItems.slice(0, safeLimit),
  };
}
