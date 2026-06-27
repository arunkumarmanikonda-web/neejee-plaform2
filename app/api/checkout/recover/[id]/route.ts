// app/api/checkout/recover/[id]/route.ts
// v26.3b — Resolves a recovery-link click into a checkout-ready state.
// Only verifiedItems from the prepaid snapshot are accepted.
// Empty/invalid snapshots are treated as gone and cannot be recovered.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseSnapshot(itemsJson: string) {
  try {
    const data = JSON.parse(itemsJson || '{}');
    const verifiedItems = Array.isArray(data?.verifiedItems) ? data.verifiedItems : [];
    return {
      data,
      verifiedItems,
    };
  } catch {
    return {
      data: null,
      verifiedItems: [],
    };
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const cart = await prisma.abandonedCart.findUnique({
      where: { id: params.id },
    });

    if (!cart) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (cart.recoveredOrderId) {
      return NextResponse.json({ recovered: true, orderRef: cart.recoveredOrderId });
    }

    if (cart.optedOut) {
      return NextResponse.json({ error: 'Opted out' }, { status: 410 });
    }

    const { data, verifiedItems } = parseSnapshot(cart.itemsJson);

    if (verifiedItems.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'snapshot_empty_items',
          message: 'Snapshot has no verified items',
        },
        { status: 410 }
      );
    }

    return NextResponse.json({
      cart: {
        id: cart.id,
        email: cart.email,
        customerName: cart.customerName,
        phone: (cart as any).phone,
        items: verifiedItems,
        contact: data?.contact || null,
        address: data?.address || null,
        discountCode: (cart as any).discountCode || null,
        discountPercent: (cart as any).discountPercent || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
