// /api/admin/forecast
// GET  - returns cached forecast snapshots (filter by scope/product/category)
// POST - manually trigger a refresh for a specific scope (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { computeForecast } from '@/lib/forecast/compute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

async function gate() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') || 'GLOBAL';
  const productId = url.searchParams.get('productId') || null;
  const categoryId = url.searchParams.get('categoryId') || null;

  // For PRODUCT scope without a specific product, return stock-out warnings
  if (scope === 'PRODUCT' && !productId) {
    const warnings = await prisma.forecastSnapshot.findMany({
      where: {
        scope: 'PRODUCT',
        daysUntilStockout: { lte: 14, gt: 0 },
      },
      orderBy: { daysUntilStockout: 'asc' },
      take: 50,
    });
    const productIds = warnings.map(w => w.productId).filter(Boolean) as string[];
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            slug: true,
            variants: { select: { inventory: true } },
          },
        })
      : [];
    const pMap = new Map(
      products.map(p => [
        p.id,
        {
          id: p.id,
          name: p.name,
          slug: p.slug,
          inventory: p.variants.reduce((s, v) => s + (v.inventory || 0), 0),
        },
      ])
    );
    return NextResponse.json({
      warnings: warnings.map(w => ({ ...w, product: pMap.get(w.productId || '') || null })),
    });
  }

  const snap = await prisma.forecastSnapshot.findFirst({
    where: { scope: scope as any, productId, categoryId },
  });
  if (!snap) {
    return NextResponse.json({ snapshot: null, hint: 'No snapshot yet. Run the daily forecast cron or POST to refresh.' });
  }
  return NextResponse.json({ snapshot: snap });
}

export async function POST(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const scope = body.scope || 'GLOBAL';
    const r = await computeForecast(scope, {
      productId: body.productId,
      categoryId: body.categoryId,
    });
    return NextResponse.json(r);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
