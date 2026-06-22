// Compute & persist demand forecasts for products, categories and globally.
// Uses Holt-Winters additive with weekly seasonality (season length 7).
// Returns the saved ForecastSnapshot. Cron refreshes once per day.

import { prisma } from '@/lib/prisma';
import { fitHoltWinters, densifyDailySeries } from './holt-winters';

type Scope = 'GLOBAL' | 'CATEGORY' | 'PRODUCT';

const HORIZON_DAYS = 90;
const HISTORY_DAYS = 180;        // train on last ~6 months
const SEASON_LENGTH = 7;         // weekly seasonality
const STOCKOUT_WARN_DAYS = 14;   // warn when stockout within 2 weeks

/** Daily order-item count for a (scope, id). */
async function fetchDailySeries(
  scope: Scope,
  productId: string | null,
  categoryId: string | null,
  start: Date,
  end: Date
): Promise<Array<{ date: string; value: number }>> {
  const where: any = {
    order: {
      createdAt: { gte: start, lt: end },
      // Only count revenue-generating statuses
      status: { in: ['CONFIRMED', 'SHIPPED', 'DELIVERED'] },
    },
  };
  if (scope === 'PRODUCT' && productId) where.productId = productId;
  if (scope === 'CATEGORY' && categoryId) where.product = { categoryId };

  const items = await prisma.orderItem.findMany({
    where,
    select: { quantity: true, order: { select: { createdAt: true } } },
  });

  const byDate = new Map<string, number>();
  for (const it of items) {
    const d = it.order.createdAt.toISOString().slice(0, 10);
    byDate.set(d, (byDate.get(d) || 0) + it.quantity);
  }
  return Array.from(byDate.entries()).map(([date, value]) => ({ date, value }));
}

/** Run forecast for one (scope, id) and persist the snapshot. */
export async function computeForecast(
  scope: Scope,
  ids: { productId?: string; categoryId?: string }
): Promise<{ ok: boolean; reason?: string; snapshotId?: string }> {
  const now = new Date();
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - HISTORY_DAYS);

  const sparse = await fetchDailySeries(
    scope,
    ids.productId || null,
    ids.categoryId || null,
    start,
    end
  );
  const dense = densifyDailySeries(sparse, start, end);

  // Need at least 2 full seasons of non-zero data to make a forecast
  const nonZero = dense.filter(p => p.value > 0).length;
  if (nonZero < SEASON_LENGTH * 2) {
    return { ok: false, reason: `insufficient data (${nonZero} non-zero days, need ${SEASON_LENGTH * 2})` };
  }

  const fit = fitHoltWinters(dense, { seasonLength: SEASON_LENGTH });
  if (!fit) return { ok: false, reason: 'fit failed' };

  const series = fit.forecast(HORIZON_DAYS);
  const diag = fit.diagnostics();

  // Stockout calculation (only for PRODUCT scope).
  // Inventory lives on Variant, not Product — so we sum all variant inventories.
  let reorderHint: string | null = null;
  let daysUntilStockout: number | null = null;
  if (scope === 'PRODUCT' && ids.productId) {
    const product = await prisma.product.findUnique({
      where: { id: ids.productId },
      select: {
        name: true,
        variants: { select: { inventory: true } },
      },
    });
    const totalInventory = product
      ? product.variants.reduce((s, v) => s + (v.inventory || 0), 0)
      : 0;
    if (product && totalInventory > 0) {
      let remaining = totalInventory;
      for (let i = 0; i < series.length; i++) {
        remaining -= series[i].predicted;
        if (remaining <= 0) {
          daysUntilStockout = i + 1;
          reorderHint = `At current velocity (${diag.level.toFixed(1)} units/day), '${product.name}' will stock out in ~${daysUntilStockout} day(s) (around ${series[i].date}). Consider restocking now.`;
          break;
        }
      }
      if (daysUntilStockout === null) {
        reorderHint = `Inventory sufficient: '${product.name}' will not stock out within ${HORIZON_DAYS} days at current velocity.`;
      }
    } else if (product) {
      reorderHint = `'${product.name}' is OUT OF STOCK — restock immediately.`;
      daysUntilStockout = 0;
    }
  }

  const expiresAt = new Date();
  expiresAt.setUTCHours(expiresAt.getUTCHours() + 24);

  // Upsert: schema has @@unique([scope, productId, categoryId]).
  const existing = await prisma.forecastSnapshot.findFirst({
    where: {
      scope: scope as any,
      productId: ids.productId || null,
      categoryId: ids.categoryId || null,
    },
  });

  const data = {
    scope: scope as any,
    productId: ids.productId || null,
    categoryId: ids.categoryId || null,
    windowStartDate: start,
    windowEndDate: end,
    horizonDays: HORIZON_DAYS,
    series: series as any,
    diagnostics: diag as any,
    reorderHint,
    daysUntilStockout,
    expiresAt,
  };

  const saved = existing
    ? await prisma.forecastSnapshot.update({ where: { id: existing.id }, data })
    : await prisma.forecastSnapshot.create({ data });

  return { ok: true, snapshotId: saved.id };
}

/** Refresh forecasts for all active products + categories + global. */
export async function refreshAllForecasts(): Promise<{
  global: boolean;
  categories: number;
  products: number;
  stockoutWarnings: Array<{ productId: string; productName: string; days: number }>;
}> {
  let g = false;
  let catCount = 0;
  let prodCount = 0;
  const warnings: Array<{ productId: string; productName: string; days: number }> = [];

  // GLOBAL
  const globalRes = await computeForecast('GLOBAL', {});
  g = globalRes.ok;

  // CATEGORIES
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  for (const c of categories) {
    const r = await computeForecast('CATEGORY', { categoryId: c.id });
    if (r.ok) catCount++;
  }

  // PRODUCTS — active OWNED products only (marketplace items have variable stock)
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', ownershipModel: 'OWNED' },
    select: { id: true, name: true },
  });
  for (const p of products) {
    const r = await computeForecast('PRODUCT', { productId: p.id });
    if (r.ok && r.snapshotId) {
      prodCount++;
      // Check the snapshot for stock-out warning
      const snap = await prisma.forecastSnapshot.findUnique({ where: { id: r.snapshotId } });
      if (snap?.daysUntilStockout !== null && snap?.daysUntilStockout !== undefined && snap.daysUntilStockout <= STOCKOUT_WARN_DAYS) {
        warnings.push({ productId: p.id, productName: p.name, days: snap.daysUntilStockout });
      }
    }
  }

  return { global: g, categories: catCount, products: prodCount, stockoutWarnings: warnings };
}
