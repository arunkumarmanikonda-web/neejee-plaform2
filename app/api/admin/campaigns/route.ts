// Campaign-coupon API — generic codes (not user-bound).
// Bulk-generate, list with redemption analytics, deactivate.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

function rand(n: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // unambiguous
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export async function GET() {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // List campaign coupons (those without userId — i.e. generic)
  const coupons = await prisma.coupon.findMany({
    where: { userId: null },
    orderBy: { validFrom: 'desc' },
    take: 200,
    include: {
      _count: { select: { redemptions: true } },
    },
  });

  // For each, get revenue driven (sum order totals where coupon code matches)
  const codes = coupons.map(c => c.code);
  const orders = codes.length
    ? await prisma.$queryRawUnsafe<any[]>(`
        SELECT cr."couponId", COUNT(o.id)::int AS "orderCount", COALESCE(SUM(o.total), 0)::int AS revenue
        FROM "CouponRedemption" cr
        LEFT JOIN "Order" o ON o.id = cr."orderId"
        WHERE cr."couponId" = ANY($1::text[])
        GROUP BY cr."couponId"
      `, coupons.map(c => c.id))
    : [];
  const stats = new Map(orders.map((o: any) => [o.couponId, o]));

  return NextResponse.json({
    coupons: coupons.map(c => ({
      ...c,
      redemptionCount: c._count.redemptions,
      ordersCount: (stats.get(c.id) as any)?.orderCount || 0,
      revenue: (stats.get(c.id) as any)?.revenue || 0,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      mode = 'single', // 'single' | 'bulk'
      code,
      prefix,
      count = 1,
      type = 'PERCENT',
      value,
      minCart = 0,
      maxDiscount,
      maxUses,
      perUserOnce = true,
      validFrom,
      validTo,
      active = true,
    } = body;

    if (!type || !['PERCENT', 'FLAT', 'FREE_SHIPPING'].includes(type)) {
      return NextResponse.json({ error: 'Invalid coupon type' }, { status: 400 });
    }
    if (type !== 'FREE_SHIPPING' && (typeof value !== 'number' || value <= 0)) {
      return NextResponse.json({ error: 'Coupon value must be > 0' }, { status: 400 });
    }

    const baseData = {
      type,
      value: type === 'FREE_SHIPPING' ? 0 : Math.round(value),
      minCart: Math.round(minCart || 0),
      maxDiscount: maxDiscount ? Math.round(maxDiscount) : null,
      maxUses: maxUses ? Math.round(maxUses) : null,
      perUserOnce: !!perUserOnce,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validTo: validTo ? new Date(validTo) : null,
      active: !!active,
      userId: null, // GENERIC — not user-bound
    };

    if (mode === 'single') {
      if (!code || !/^[A-Z0-9_-]{3,32}$/i.test(code)) {
        return NextResponse.json({ error: 'Code must be 3-32 alphanumeric chars' }, { status: 400 });
      }
      const created = await prisma.coupon.create({
        data: { ...baseData, code: code.toUpperCase() },
      });
      return NextResponse.json({ created: [created] });
    }

    // BULK
    const n = Math.min(Math.max(1, parseInt(count) || 1), 200);
    const safePrefix = (prefix || 'NEEJEE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'NEEJEE';
    const created: any[] = [];
    for (let i = 0; i < n; i++) {
      // Try up to 5 times per code for uniqueness
      let attempts = 0;
      while (attempts < 5) {
        const code = `${safePrefix}${rand(6)}`;
        try {
          const c = await prisma.coupon.create({ data: { ...baseData, code } });
          created.push(c);
          break;
        } catch (e: any) {
          attempts++;
        }
      }
    }
    return NextResponse.json({ created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id, active } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const updated = await prisma.coupon.update({
      where: { id },
      data: { active: !!active },
    });
    return NextResponse.json({ coupon: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
