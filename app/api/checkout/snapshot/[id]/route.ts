// app/api/checkout/snapshot/[id]/route.ts
// v26.3a — Returns lightweight snapshot info for the payment page display.
// Does NOT expose the full itemsJson to the client (privacy/PII).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    // Cast to any to access v26.3a fields without full Prisma client refresh
    const cart: any = await (prisma.abandonedCart.findUnique as any)({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        customerName: true,
        phone: true,
        subtotal: true,
        itemCount: true,
        recoveredOrderId: true,
        itemsJson: true,
      },
    });
    if (!cart) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (cart.recoveredOrderId) return NextResponse.json({ error: 'Already converted' }, { status: 410 });

    let total = cart.subtotal;
    try {
      const data = JSON.parse(cart.itemsJson);
      if (data?.pricing?.total) total = data.pricing.total;
    } catch { /* swallow */ }

    return NextResponse.json({
      snapshot: {
        id: cart.id,
        email: cart.email,
        customerName: cart.customerName,
        phone: cart.phone,
        total,
        itemCount: cart.itemCount,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}