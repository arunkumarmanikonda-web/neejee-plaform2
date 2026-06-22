// Validate a coupon against current cart subtotal.
// Enforces:
//   - active, dates, total uses, min cart
//   - userId binding (if coupon.userId is set, only that user can redeem)
//   - perUserOnce (if true, blocks if this user already redeemed via CouponRedemption ledger)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { code, subtotal } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    const sub = parseInt(subtotal || 0); // paise

    const session = await getSession();

    const coupon = await prisma.coupon.findUnique({
      where: { code: String(code).toUpperCase().trim() },
    });
    if (!coupon) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
    if (!coupon.active) return NextResponse.json({ error: 'Coupon is inactive' }, { status: 400 });

    const now = new Date();
    if (coupon.validFrom && coupon.validFrom > now) {
      return NextResponse.json({ error: 'Coupon not yet active' }, { status: 400 });
    }
    if (coupon.validTo && coupon.validTo < now) {
      return NextResponse.json({ error: 'Coupon has expired' }, { status: 400 });
    }
    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ error: 'Coupon usage limit reached' }, { status: 400 });
    }
    if (coupon.minCart && sub < coupon.minCart) {
      return NextResponse.json({
        error: `Minimum cart of ₹${(coupon.minCart / 100).toLocaleString('en-IN')} required`,
      }, { status: 400 });
    }

    // User-bound coupon (e.g. welcome coupon) — only the named user can use it
    if (coupon.userId) {
      if (!session?.id) {
        return NextResponse.json({ error: 'Please sign in to use this code' }, { status: 401 });
      }
      if (session.id !== coupon.userId) {
        return NextResponse.json({ error: 'This code belongs to another account' }, { status: 403 });
      }
    }

    // Per-user once (for future generic coupons like WELCOME10)
    if (coupon.perUserOnce && session?.id) {
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
    } else if (coupon.type === 'FREE_SHIPPING') {
      discountPaise = 0;
    }

    return NextResponse.json({
      code: coupon.code,
      type: coupon.type,
      discountPaise,
      freeShipping: coupon.type === 'FREE_SHIPPING',
      personalised: !!coupon.userId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
