// Returns coupons belonging to the signed-in user.
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
        id: true,
        code: true,
        type: true,
        value: true,
        minCart: true,
        maxDiscount: true,
        maxUses: true,
        usedCount: true,
        perUserOnce: true,
        validFrom: true,
        validTo: true,
        active: true,
        redemptions: {
          where: { userId: session.id },
          select: { id: true, redeemedAt: true },
          take: 1,
        },
      },
    });
    const now = new Date();

    return NextResponse.json({
      coupons: coupons.map((coupon) => {
        const redeemed = coupon.redemptions.length > 0;
        const exhausted = coupon.maxUses != null && coupon.usedCount >= coupon.maxUses;
        return {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          minCart: coupon.minCart,
          maxDiscount: coupon.maxDiscount,
          validFrom: coupon.validFrom,
          validTo: coupon.validTo,
          status:
            !coupon.active ? 'INACTIVE' :
            (redeemed && coupon.perUserOnce) || exhausted ? 'USED' :
            (coupon.validFrom && coupon.validFrom > now) ? 'UPCOMING' :
            (coupon.validTo && coupon.validTo < now) ? 'EXPIRED' :
            'AVAILABLE',
        };
      }),
    });
  } catch (error: any) {
    console.error('[my-coupons] failed', { userId: session.id, message: error?.message });
    return NextResponse.json({ error: 'Your codes are temporarily unavailable', coupons: [] }, { status: 500 });
  }
}
