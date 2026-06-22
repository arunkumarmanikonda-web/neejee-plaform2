// app/api/checkout/recover/[id]/route.ts
// v26.3a — Resolves a recovery-link click into a checkout-ready state.
// Rehydrates the cart items into the customer's session-side cart store
// (returns the data; the client merges it). Also auto-applies the
// discount code if one is on the snapshot.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const cart = await prisma.abandonedCart.findUnique({
      where: { id: params.id },
    });
    if (!cart) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (cart.recoveredOrderId) {
      return NextResponse.json({ recovered: true, orderRef: cart.recoveredOrderId });
    }
    if (cart.optedOut) return NextResponse.json({ error: 'Opted out' }, { status: 410 });

    let items: any[] = [];
    let contact: any = null;
    let address: any = null;
    try {
      const data = JSON.parse(cart.itemsJson);
      items = data?.verifiedItems || data?.items || [];
      contact = data?.contact || null;
      address = data?.address || null;
    } catch { /* swallow */ }

    return NextResponse.json({
      cart: {
        id: cart.id,
        email: cart.email,
        customerName: cart.customerName,
        phone: (cart as any).phone,
        items,
        contact,
        address,
        discountCode: (cart as any).discountCode || null,
        discountPercent: (cart as any).discountPercent || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
