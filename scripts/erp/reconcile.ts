import { prisma } from '../../lib/prisma';
import { getErpAdapter } from '../../lib/erp/adapter';
import {
  buildErpReconciliationRows,
  buildPlatformReconciliationRows,
  createErpReconciliationResponse,
  normalizeReconciliationFilter,
} from '../../lib/erp/reconciliation';

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function normalizeLimit(rawValue: string | null): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 500;
  return Math.min(1000, Math.floor(parsed));
}

async function main() {
  const adapter = getErpAdapter();
  const filter = normalizeReconciliationFilter(readArg('filter'));
  const limit = normalizeLimit(readArg('limit'));

  const platformProducts = await prisma.product.findMany({
    select: {
      id: true,
      sku: true,
      slug: true,
      name: true,
      status: true,
      mrp: true,
      sellingPrice: true,
      updatedAt: true,
      variants: {
        select: {
          inventory: true,
        },
      },
    },
    orderBy: {
      sku: 'asc',
    },
  });

  const erpProducts = await adapter.listProducts({
    status: 'ALL',
  });

  const priceEntries = await Promise.all(
    erpProducts.map(async (product) => {
      const price = await adapter.getPriceBySku(product.sku);
      return [product.sku.trim().toUpperCase(), price] as const;
    })
  );

  const stockEntries = await Promise.all(
    erpProducts.map(async (product) => {
      const stock = await adapter.getStockBySku(product.sku);
      return [product.sku.trim().toUpperCase(), stock] as const;
    })
  );

  const report = createErpReconciliationResponse({
    generatedAt: new Date().toISOString(),
    adapterKind: adapter.kind,
    filter,
    limit,
    platformRows: buildPlatformReconciliationRows(platformProducts),
    erpRows: buildErpReconciliationRows(
      erpProducts,
      Object.fromEntries(priceEntries),
      Object.fromEntries(stockEntries)
    ),
  });

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
