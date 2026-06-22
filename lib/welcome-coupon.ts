// Generate a personalised single-use welcome coupon for a new user.
//
// Strategy (handles name collisions cleanly):
//   1. Try base code: <FIRSTNAME>10NEEJEE  (e.g. ARUN10NEEJEE)
//   2. On collision: <FIRSTNAME>10NEEJEE<NNNN>  where NNNN = 4-digit count of users
//      with that first name (e.g. ARUN10NEEJEE002, ARUN10NEEJEE003, …)
//   3. The coupon is bound to a specific userId — only that user can redeem it,
//      so even if two people somehow share a code, only one can use it.
//
// Result: First Arun gets the clean code. Subsequent Aruns get a numbered version.
// Both are equally personal because they are bound to the user's account.

import { prisma } from './prisma';

function sanitize(name: string): string {
  return (name || 'FRIEND')
    .split(' ')[0]
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 12) || 'FRIEND';
}

interface WelcomeCouponResult {
  code: string;
  id: string;
}

export async function generateWelcomeCoupon(
  name: string,
  userId: string,
): Promise<WelcomeCouponResult | null> {
  const firstName = sanitize(name);
  const base = `${firstName}10NEEJEE`;
  const validTo = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days

  // Try base code first
  let candidate = base;
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const coupon = await prisma.coupon.create({
        data: {
          code: candidate,
          userId,                 // Bind to this user only
          perUserOnce: false,     // Not relevant when userId is set
          type: 'PERCENT',
          value: 10,
          minCart: 0,
          maxUses: 1,
          validFrom: new Date(),
          validTo,
          active: true,
        },
      });
      return { code: coupon.code, id: coupon.id };
    } catch (e: any) {
      // Unique constraint on code — derive the next numbered variant
      if (e.code === 'P2002') {
        // Count existing coupons starting with this firstName base
        const count = await prisma.coupon.count({
          where: { code: { startsWith: base } },
        });
        // Pad to 3 digits: ARUN10NEEJEE002, ARUN10NEEJEE003
        candidate = `${base}${String(count + 1).padStart(3, '0')}`;
        continue;
      }
      console.warn('[welcome-coupon] create failed:', e.message);
      return null;
    }
  }
  console.warn('[welcome-coupon] exhausted retries for', base);
  return null;
}
