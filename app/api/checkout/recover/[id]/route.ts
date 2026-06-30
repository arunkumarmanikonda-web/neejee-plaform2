// app/api/checkout/recover/[id]/route.ts
// v26.3c — Resolves a recovery-link click into a checkout-ready state.
// Only verifiedItems from the structured snapshot are accepted.
// Also returns richer checkout hydration data.

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
      const order = await prisma.order.findUnique({
        where: { id: cart.recoveredOrderId },
        select: { orderNumber: true },
      }).catch(() => null);

      return NextResponse.json({
        recovered: true,
        orderRef: order?.orderNumber || cart.recoveredOrderId,
        orderNumber: order?.orderNumber || null,
      });
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
        customerName: (cart as any).customerName || null,
        phone: (cart as any).phone || null,
        items: verifiedItems,
        contact: data?.contact || {
          email: cart.email,
          phone: (cart as any).phone || '',
        },
        address: data?.address || null,
        pricing: data?.pricing || null,
        giftWrap: !!data?.giftWrap,
        personalNote: data?.personalNote || '',
        gstinCustomer: data?.gstinCustomer || null,
        discountCode: (cart as any).discountCode || null,
        discountPercent: (cart as any).discountPercent || null,
        discountPaise:
          typeof data?.pricing?.discount === 'number' ? data.pricing.discount : 0,
        paymentMethodPicked: (cart as any).paymentMethodPicked || null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
