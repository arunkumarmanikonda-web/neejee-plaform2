import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { computeForecast } from '@/lib/forecast/compute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
const STOCKOUT_WARNING_DAYS = 14;

async function gate() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

function normalizeScope(raw: unknown): 'GLOBAL' | 'PRODUCT' | 'CATEGORY' {
  const value = String(raw || 'GLOBAL').trim().toUpperCase();
  if (value === 'PRODUCT' || value === 'CATEGORY') return value;
  return 'GLOBAL';
}

function missingHint(scope: 'GLOBAL' | 'PRODUCT' | 'CATEGORY', productId: string | null, categoryId: string | null) {
  if (scope === 'PRODUCT' && !productId) {
    return 'Pick a product to load its forecast snapshot.';
  }
  if (scope === 'CATEGORY' && !categoryId) {
    return 'Pick a category to load its forecast snapshot.';
  }
  return 'No snapshot yet. Run the daily forecast cron or click REFRESH NOW to compute one.';
}

export async function GET(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;

  const url = new URL(req.url);
  const scope = normalizeScope(url.searchParams.get('scope'));
  const productId = url.searchParams.get('productId') || null;
  const categoryId = url.searchParams.get('categoryId') || null;

  if (scope === 'PRODUCT' && !productId) {
    const warnings = await prisma.forecastSnapshot.findMany({
      where: {
        scope: 'PRODUCT',
        daysUntilStockout: { lte: STOCKOUT_WARNING_DAYS, gt: 0 },
      },
      orderBy: [{ daysUntilStockout: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });

    const productIds = warnings.map((w) => w.productId).filter(Boolean) as string[];
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
      products.map((p) => [
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
      warnings: warnings.map((w) => ({ ...w, product: pMap.get(w.productId || '') || null })),
      summary: {
        count: warnings.length,
        thresholdDays: STOCKOUT_WARNING_DAYS,
      },
    });
  }

  if ((scope === 'PRODUCT' && !productId) || (scope === 'CATEGORY' && !categoryId)) {
    return NextResponse.json({
      snapshot: null,
      hint: missingHint(scope, productId, categoryId),
    });
  }

  const snap = await prisma.forecastSnapshot.findFirst({
    where: { scope: scope as any, productId, categoryId },
    orderBy: { createdAt: 'desc' },
  });

  if (!snap) {
    return NextResponse.json({
      snapshot: null,
      hint: missingHint(scope, productId, categoryId),
    });
  }

  return NextResponse.json({
    snapshot: snap,
    stale: new Date(snap.expiresAt).getTime() <= Date.now(),
    hint: '',
  });
}

export async function POST(req: NextRequest) {
  const g = await gate();
  if (g.error) return g.error;

  try {
    const body = await req.json();
    const scope = normalizeScope(body?.scope);
    const productId = body?.productId ? String(body.productId) : undefined;
    const categoryId = body?.categoryId ? String(body.categoryId) : undefined;

    if (scope === 'PRODUCT' && !productId) {
      return NextResponse.json(
        { ok: false, error: 'Pick a product before refreshing product-level forecast.' },
        { status: 400 }
      );
    }

    if (scope === 'CATEGORY' && !categoryId) {
      return NextResponse.json(
        { ok: false, error: 'Pick a category before refreshing category-level forecast.' },
        { status: 400 }
      );
    }

    const result = await computeForecast(scope, { productId, categoryId });
    return NextResponse.json({ ...result, scope });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed' }, { status: 500 });
  }
}