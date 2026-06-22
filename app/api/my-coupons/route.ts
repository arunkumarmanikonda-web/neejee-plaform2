// Returns all coupons belonging to the signed-in user (welcome + any future per-user coupons)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const coupons = await prisma.coupon.findMany({
      where: { userId: session.id },
      orderBy: { validFrom: 'desc' },
      select: {
        id: true, code: true, type: true, value: true,
        minCart: true, maxDiscount: true, maxUses: true, usedCount: true,
        validFrom: true, validTo: true, active: true,
      },
    });
    const now = new Date();
    return NextResponse.json({
      coupons: coupons.map(c => ({
        ...c,
        status:
          !c.active ? 'INACTIVE' :
          (c.maxUses && c.usedCount >= c.maxUses) ? 'USED' :
          (c.validTo && c.validTo < now) ? 'EXPIRED' :
          'AVAILABLE',
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ coupons: [], error: e.message }, { status: 500 });
  }
}
