import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { getErpAdapter } from '@/lib/erp/adapter';
import {
  ERP_RECONCILIATION_VERSION,
  buildErpReconciliationRows,
  buildPlatformReconciliationRows,
  createErpReconciliationResponse,
  normalizeReconciliationFilter,
} from '@/lib/erp/reconciliation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizeLimit(rawValue: string | null): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return 200;
  return Math.min(500, Math.floor(parsed));
}

export async function GET(request: Request) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const filter = normalizeReconciliationFilter(url.searchParams.get('filter'));
  const limit = normalizeLimit(url.searchParams.get('limit'));

  try {
    const adapter = getErpAdapter();

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

    const response = createErpReconciliationResponse({
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

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to build ERP reconciliation report',
        version: ERP_RECONCILIATION_VERSION,
        generatedAt: new Date().toISOString(),
        adapterKind: 'unknown',
        filter,
        summary: {
          total: 0,
          matched: 0,
          drift: 0,
          missingInErp: 0,
          missingInPlatform: 0,
          statusMismatchCount: 0,
          sellingPriceMismatchCount: 0,
          mrpMismatchCount: 0,
          inventoryMismatchCount: 0,
        },
        items: [],
      },
      { status: 500 }
    );
  }
}
