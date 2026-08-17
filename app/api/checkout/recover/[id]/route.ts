// Resolves a signed recovery-link click into checkout-ready state.
// The signed reference is the authorization mechanism for returning customer
// contact/address/cart data to the recovery page.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyRecoveryRef } from '@/lib/recovery/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseSnapshot(itemsJson: string) {
  try {
    const data = JSON.parse(itemsJson || '{}');
    const verifiedItems = Array.isArray(data?.verifiedItems) ? data.verifiedItems : [];
    return { data, verifiedItems };
  } catch {
    return { data: null, verifiedItems: [] };
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const recovery = verifyRecoveryRef(params.id);
    if (!recovery.ok || !recovery.cartId) {
      return NextResponse.json({
        error: recovery.reason === 'expired'
          ? 'This recovery link has expired.'
          : 'This recovery link is invalid.',
      }, { status: recovery.reason === 'expired' ? 410 : 404 });
    }

    const cart = await prisma.abandonedCart.findUnique({
      where: { id: recovery.cartId },
    });
    if (!cart) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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

    if (cart.optedOut) return NextResponse.json({ error: 'Opted out' }, { status: 410 });

    const { data, verifiedItems } = parseSnapshot(cart.itemsJson);
    if (verifiedItems.length === 0) {
      return NextResponse.json({
        ok: false,
        code: 'snapshot_empty_items',
        message: 'Snapshot has no verified items',
      }, { status: 410 });
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
  } catch (error: any) {
    console.error('[checkout.recover]', error?.message);
    return NextResponse.json({ error: 'Unable to recover this trunk right now' }, { status: 500 });
  }
}
