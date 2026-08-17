// Validate a coupon against current cart subtotal.
// Enforces:
//   - active, dates, total uses, min cart
//   - userId binding (if coupon.userId is set, only that user can redeem)
//   - perUserOnce requires an authenticated user and blocks prior redemption
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { code, subtotal } = await request.json();
    const normalizedCode = String(code || '').toUpperCase().trim();
    if (!normalizedCode) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    const sub = Number.parseInt(String(subtotal ?? 0), 10);
    if (!Number.isFinite(sub) || sub < 0) {
      return NextResponse.json({ error: 'Invalid cart subtotal' }, { status: 400 });
    }

    const session = await getSession();
    const coupon = await prisma.coupon.findUnique({ where: { code: normalizedCode } });

    if (!coupon) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    if (!coupon.active) return NextResponse.json({ error: 'Coupon is inactive' }, { status: 400 });

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      return NextResponse.json({ error: 'Coupon not yet active' }, { status: 400 });
    }
    if (coupon.validTo && coupon.validTo < now) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 });
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ error: 'Coupon usage limit reached' }, { status: 400 });
    }
    if (coupon.minCart != null && sub < coupon.minCart) {
      return NextResponse.json({
        error: `Minimum cart of ₹${(coupon.minCart / 100).toLocaleString('en-IN')} required`,
      }, { status: 400 });
    }

    if (coupon.userId) {
      if (!session?.id) {
        return NextResponse.json({ error: 'Please sign in to use this code' }, { status: 401 });
      }
      if (session.id !== coupon.userId) {
        return NextResponse.json({ error: 'This code belongs to another account' }, { status: 403 });
      }
    }

    if (coupon.perUserOnce) {
      if (!session?.id) {
        return NextResponse.json({ error: 'Please sign in to use this one-time code' }, { status: 401 });
      }
      const used = await prisma.couponRedemption.findUnique({
        where: { couponId_userId: { couponId: coupon.id, userId: session.id } },
      });
      if (used) {
        return NextResponse.json({ error: 'You have already used this code' }, { status: 400 });
      }
    }

    let discountPaise = 0;
    if (coupon.type === 'PERCENT') {
      discountPaise = Math.round((sub * coupon.value) / 100);
      if (coupon.maxDiscount && discountPaise > coupon.maxDiscount) {
        discountPaise = coupon.maxDiscount;
      }
    } else if (coupon.type === 'FLAT') {
      discountPaise = Math.min(coupon.value, sub);
    }

    return NextResponse.json({
      code: coupon.code,
      type: coupon.type,
      discountPaise,
      freeShipping: coupon.type === 'FREE_SHIPPING',
      personalised: !!coupon.userId,
      requiresAccount: !!coupon.userId || coupon.perUserOnce,
    });
  } catch (e: any) {
    console.error('[coupons.validate] failed:', e?.message);
    return NextResponse.json({ error: 'Unable to validate coupon right now' }, { status: 500 });
  }
}
