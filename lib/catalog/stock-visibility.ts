import type {
  CatalogueStockVisibility,
  ProductReadStock,
} from './contracts';

export type StockVariantSource = {
  inventory?: number | null;
  lowStockThreshold?: number | null;
};

export type StockReadSourceRow = {
  catalogueStockVisibility?: string | null;
  variants?: StockVariantSource[] | null;
};

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function parseInteger(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeStockVisibility(
  value: unknown
): CatalogueStockVisibility {
  const raw = asString(value)?.toUpperCase();

  if (!raw) return 'IN_STOCK_ONLY';
  if (raw === 'SHOW_ALL' || raw === 'SHOW_EXACT') return 'SHOW_ALL';
  if (raw === 'HIDE_STOCK') return 'HIDE_STOCK';
  if (raw === 'LOW_STOCK_BADGE' || raw === 'IN_STOCK_ONLY') {
    return 'IN_STOCK_ONLY';
  }

  return 'IN_STOCK_ONLY';
}

export function deriveStock(
  product: StockReadSourceRow
): ProductReadStock {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  const totalInventory = variants.reduce((sum, variant) => {
    return sum + parseInteger(variant?.inventory, 0);
  }, 0);

  const lowStock = variants.some((variant) => {
    const qty = parseInteger(variant?.inventory, 0);
    const threshold = parseInteger(variant?.lowStockThreshold, 3);
    return qty > 0 && qty <= threshold;
  });

  const stockVisibility = normalizeStockVisibility(
    product.catalogueStockVisibility
  );
  const inStock = totalInventory > 0;
  const availableQuantity =
    stockVisibility === 'SHOW_ALL' ? totalInventory : null;

  let label = 'Out of stock';

  if (stockVisibility === 'HIDE_STOCK') {
    label = inStock ? 'Available' : 'Unavailable';
  } else if (stockVisibility === 'SHOW_ALL') {
    label = inStock ? `${totalInventory} available` : 'Out of stock';
  } else {
    label = inStock ? (lowStock ? 'Low stock' : 'In stock') : 'Out of stock';
  }

  return {
    inStock,
    totalInventory,
    lowStock,
    stockVisibility,
    availableQuantity,
    showExactQuantity: stockVisibility === 'SHOW_ALL',
    label,
    purchasable: inStock,
  };
}
