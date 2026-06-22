// Per-seller commission overrides: category + product.
// GET   /api/admin/sellers/{id}/commissions
// POST  /api/admin/sellers/{id}/commissions  body: { type: 'category'|'product', refId, commissionPercent }
// DELETE /api/admin/sellers/{id}/commissions?type=category&refId=...
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'FINANCE'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const sellerId = params.id;
    const [seller, cats, prods] = await Promise.all([
      prisma.seller.findUnique({
        where: { id: sellerId },
        select: { id: true, businessName: true, commissionPct: true },
      }),
      prisma.sellerCategoryCommission.findMany({ where: { sellerId } }),
      prisma.sellerProductCommission.findMany({ where: { sellerId } }),
    ]);
    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

    // Hydrate category & product names
    const catIds = Array.from(new Set(cats.map(c => c.categoryId)));
    const prodIds = Array.from(new Set(prods.map(p => p.productId)));
    const [catRows, prodRows] = await Promise.all([
      catIds.length ? prisma.category.findMany({
        where: { id: { in: catIds } },
        select: { id: true, name: true },
      }) : Promise.resolve([]),
      prodIds.length ? prisma.product.findMany({
        where: { id: { in: prodIds } },
        select: { id: true, name: true, sku: true },
      }) : Promise.resolve([]),
    ]);
    const catMap = new Map(catRows.map(c => [c.id, c]));
    const prodMap = new Map(prodRows.map(p => [p.id, p]));

    return NextResponse.json({
      seller,
      categoryCommissions: cats.map(c => ({ ...c, category: catMap.get(c.categoryId) || null })),
      productCommissions: prods.map(p => ({ ...p, product: prodMap.get(p.productId) || null })),
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { type, refId, commissionPercent, defaultCommissionPct } = await req.json();
    const sellerId = params.id;

    // Special case: update the seller's default commissionPct
    if (defaultCommissionPct != null) {
      const v = parseFloat(defaultCommissionPct);
      if (isNaN(v) || v < 0 || v > 100) {
        return NextResponse.json({ error: 'commissionPercent must be 0–100' }, { status: 400 });
      }
      const updated = await prisma.seller.update({
        where: { id: sellerId },
        data: { commissionPct: v },
      });
      return NextResponse.json({ seller: updated });
    }

    if (!type || !refId || commissionPercent == null) {
      return NextResponse.json({ error: 'type, refId and commissionPercent required' }, { status: 400 });
    }
    const v = parseFloat(commissionPercent);
    if (isNaN(v) || v < 0 || v > 100) {
      return NextResponse.json({ error: 'commissionPercent must be 0–100' }, { status: 400 });
    }

    if (type === 'category') {
      const row = await prisma.sellerCategoryCommission.upsert({
        where: { sellerId_categoryId: { sellerId, categoryId: refId } },
        update: { commissionPercent: v },
        create: { sellerId, categoryId: refId, commissionPercent: v },
      });
      return NextResponse.json({ commission: row });
    }
    if (type === 'product') {
      const row = await prisma.sellerProductCommission.upsert({
        where: { sellerId_productId: { sellerId, productId: refId } },
        update: { commissionPercent: v },
        create: { sellerId, productId: refId, commissionPercent: v },
      });
      return NextResponse.json({ commission: row });
    }
    return NextResponse.json({ error: 'type must be category or product' }, { status: 400 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const refId = url.searchParams.get('refId');
    if (!type || !refId) return NextResponse.json({ error: 'type and refId required' }, { status: 400 });
    const sellerId = params.id;

    if (type === 'category') {
      await prisma.sellerCategoryCommission.delete({
        where: { sellerId_categoryId: { sellerId, categoryId: refId } },
      });
    } else if (type === 'product') {
      await prisma.sellerProductCommission.delete({
        where: { sellerId_productId: { sellerId, productId: refId } },
      });
    } else {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
