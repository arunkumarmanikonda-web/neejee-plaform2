// lib/recovery/discount.ts
// v26.3a — Generates per-cart recovery discount codes.
// Codes are Coupon rows bound to the cart owner's email/userId, single-use,
// time-limited (next stage's window). On checkout, the existing /api/checkout
// coupon path enforces userId binding and perUserOnce ledger.

import { prisma } from '@/lib/prisma';

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit confusing chars
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export interface CreateRecoveryCouponInput {
  cartId: string;          // AbandonedCart.id
  userId?: string | null;
  email: string;
  percent: number;         // e.g. 10 or 15
  validHours: number;      // how long the code lives
  minCartPaise?: number;
  maxDiscountPaise?: number;
}

export async function createRecoveryCoupon(input: CreateRecoveryCouponInput): Promise<{
  code: string;
  couponId: string;
  validTo: Date;
}> {
  const validTo = new Date(Date.now() + input.validHours * 60 * 60 * 1000);

  // Try up to 5 times to find an unused code
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `TRUNK-${randomCode()}`;
    try {
      const coupon = await prisma.coupon.create({
        data: {
          code,
          userId: input.userId || null,
          perUserOnce: true,
          type: 'PERCENT',
          value: input.percent,
          minCart: input.minCartPaise || 0,
          maxDiscount: input.maxDiscountPaise || null,
          maxUses: 1,
          validFrom: new Date(),
          validTo,
          active: true,
        },
      });
      return { code: coupon.code, couponId: coupon.id, validTo };
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // Unique violation on code — retry
        continue;
      }
      throw e;
    }
  }
  throw new Error('Could not generate unique recovery coupon code after 5 attempts');
}

/**
 * Convenience: ensure a recovery coupon exists for a stage.
 * Stores the code on the AbandonedCart row for later email rendering.
 */
export async function ensureStageCoupon(
  cart: { id: string; userId: string | null; email: string; discountCode: string | null; discountPercent: number | null },
  stage: 2 | 3,
  defaults: { percent2: number; percent3: number; validHours2: number; validHours3: number }
): Promise<{ code: string; percent: number }> {
  // If already issued at this stage with right percent, reuse
  const targetPct = stage === 2 ? defaults.percent2 : defaults.percent3;
  if (cart.discountCode && cart.discountPercent === targetPct) {
    return { code: cart.discountCode, percent: cart.discountPercent };
  }

  const validHours = stage === 2 ? defaults.validHours2 : defaults.validHours3;

  const { code } = await createRecoveryCoupon({
    cartId: cart.id,
    userId: cart.userId,
    email: cart.email,
    percent: targetPct,
    validHours,
  });

  await prisma.abandonedCart.update({
    where: { id: cart.id },
    data: { discountCode: code, discountPercent: targetPct } as any,
  });

  return { code, percent: targetPct };
}
