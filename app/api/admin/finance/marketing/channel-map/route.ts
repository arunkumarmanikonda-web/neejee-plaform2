// Coupon → expense-category attribution map.
// GET /api/admin/finance/marketing/channel-map   — list with coupon details
// POST /api/admin/finance/marketing/channel-map  body: { couponId, expenseCategoryId, notes? }
// DELETE /api/admin/finance/marketing/channel-map?id=

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const maps = await prisma.marketingChannelMap.findMany({ orderBy: { createdAt: 'desc' } });
    // Hydrate coupon & category labels via two parallel queries
    const couponIds = Array.from(new Set(maps.map(m => m.couponId)));
    const catIds = Array.from(new Set(maps.map(m => m.expenseCategoryId)));

    const [coupons, cats] = await Promise.all([
      couponIds.length
        ? (prisma as any).coupon.findMany({
            where: { id: { in: couponIds } },
            select: { id: true, code: true, name: true },
          }).catch(() => [])
        : Promise.resolve([]),
      prisma.expenseCategory.findMany({
        where: { id: { in: catIds } },
        select: { id: true, code: true, label: true },
      }),
    ]);

    const couponMap = new Map(coupons.map((c: any) => [c.id, c]));
    const catMap = new Map(cats.map(c => [c.id, c]));

    return NextResponse.json({
      maps: maps.map(m => ({
        ...m,
        coupon: couponMap.get(m.couponId) || null,
        category: catMap.get(m.expenseCategoryId) || null,
      })),
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const { couponId, expenseCategoryId, notes } = await req.json();
    if (!couponId || !expenseCategoryId) {
      return NextResponse.json({ error: 'couponId and expenseCategoryId required' }, { status: 400 });
    }
    const row = await prisma.marketingChannelMap.upsert({
      where: { couponId },
      update: { expenseCategoryId, notes: notes || null },
      create: { couponId, expenseCategoryId, notes: notes || null },
    });
    return NextResponse.json({ map: row });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.admin');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.marketingChannelMap.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
