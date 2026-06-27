// app/api/checkout/snapshot/[id]/route.ts
// v26.3b — Returns lightweight snapshot info for the payment page display.
// Rejects empty/invalid prepaid snapshots so the payment page cannot present
// a broken snapshot as payable.

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

    if (!cart) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (cart.recoveredOrderId) {
      return NextResponse.json({ error: 'Already converted' }, { status: 410 });
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

    const total =
      typeof data?.pricing?.total === 'number' && data.pricing.total > 0
        ? data.pricing.total
        : cart.subtotal;

    const itemCount =
      verifiedItems.reduce((sum: number, item: any) => sum + (item?.quantity || 0), 0) ||
      cart.itemCount;

    return NextResponse.json({
      snapshot: {
        id: cart.id,
        email: cart.email,
        customerName: cart.customerName,
        phone: cart.phone,
        total,
        itemCount,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
