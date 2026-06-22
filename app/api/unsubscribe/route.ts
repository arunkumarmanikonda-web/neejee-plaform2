// Unsubscribe handler — turns off marketing flags or opts-out an abandoned cart.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { email, cartId } = await request.json();

    if (cartId) {
      await prisma.abandonedCart.updateMany({
        where: { id: cartId },
        data: { optedOut: true },
      });
    }

    if (email) {
      const normalised = String(email).toLowerCase().trim();
      // Opt out marketing flags for user
      await prisma.user.updateMany({
        where: { email: normalised },
        data: { marketingConsent: false, emailOptIn: false },
      });
      // Opt out any active abandoned carts for this email
      await prisma.abandonedCart.updateMany({
        where: { email: normalised, recoveredOrderId: null, optedOut: false },
        data: { optedOut: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
