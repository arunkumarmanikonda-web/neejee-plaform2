import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { readStockFeed } from '@/lib/erp/reconciliation/feed';
import { parseStockSheet } from '@/lib/erp/reconciliation/stock-sheet';
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

async function loadPlatform(){
  return prisma.product.findMany({
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
    const platformProducts = await loadPlatform();
    if (process.env.ERP_STOCK_FEED_URL) {
      const erpRows=await readStockFeed(process.env.ERP_STOCK_FEED_URL,process.env.ERP_STOCK_FEED_TOKEN);
      return NextResponse.json(createErpReconciliationResponse({generatedAt:new Date().toISOString(),adapterKind:'Connected stock feed',filter,limit,platformRows:buildPlatformReconciliationRows(platformProducts),erpRows}),{headers:{'Cache-Control':'no-store'}});
    }
    const adapter = getErpAdapter();

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

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user,['ADMIN','SUPER_ADMIN','CONTENT_EDITOR'])) return NextResponse.json({error:'Unauthorized'},{status:401});
  if (Number(request.headers.get('content-length'))>1500000) return NextResponse.json({error:'Use a CSV smaller than 1.5 MB.'},{status:413});
  const csv=await request.text();
  if (csv.length>1500000) return NextResponse.json({error:'Use a CSV smaller than 1.5 MB.'},{status:413});
  const timestamp=new Date().toISOString();
  let erpRows;
  try { erpRows=parseStockSheet(csv,timestamp); }
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid stock sheet'},{status:400});}
  const url=new URL(request.url);
  const report=createErpReconciliationResponse({generatedAt:timestamp,adapterKind:'Uploaded stock sheet',filter:normalizeReconciliationFilter(url.searchParams.get('filter')),limit:normalizeLimit(url.searchParams.get('limit')),platformRows:buildPlatformReconciliationRows(await loadPlatform()),erpRows});
  return NextResponse.json(report,{headers:{'Cache-Control':'no-store'}});
}
