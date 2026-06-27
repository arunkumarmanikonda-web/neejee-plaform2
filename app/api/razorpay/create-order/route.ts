// app/api/razorpay/create-order/route.ts
// v26.3a — Now accepts snapshotId (AbandonedCart row id) instead of an
// already-created NEEJEE order. No NEEJEE Order is created here either —
// only the Razorpay order. The NEEJEE Order is materialized by
// /api/razorpay/verify once the signature is verified.
//
// Backward compat: also accepts { orderNumber } for legacy clients still on
// the COD-style flow (which DOES have an Order). If both are sent, snapshotId
// wins.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Razorpay from 'razorpay';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { snapshotId, orderNumber } = body;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({
        error: 'Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      }, { status: 500 });
    }
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

    // ─── New path: snapshot-based prepaid flow ──────────────────────────
    if (snapshotId) {
      const snapshot = await prisma.abandonedCart.findUnique({
        where: { id: snapshotId },
      });
      if (!snapshot) {
        return NextResponse.json({ error: 'Cart snapshot not found' }, { status: 404 });
      }
      if (snapshot.recoveredOrderId) {
        return NextResponse.json({ error: 'Already converted to order' }, { status: 400 });
      }

      const data: any = snapshot.itemsJson ? JSON.parse(snapshot.itemsJson) : {};
const verifiedItems = Array.isArray(data?.verifiedItems) ? data.verifiedItems : [];

if (verifiedItems.length === 0) {
  return NextResponse.json(
    {
      ok: false,
      code: 'snapshot_empty_items',
      message: 'Snapshot has no verified items',
    },
    { status: 422 }
  );
}

const totalPaise = data?.pricing?.total || snapshot.subtotal;
      if (!totalPaise || totalPaise <= 0) {
        return NextResponse.json({ error: 'Invalid cart total' }, { status: 400 });
      }

      const rzpOrder = await rzp.orders.create({
        amount: totalPaise,
        currency: 'INR',
        receipt: `snap_${snapshot.id.slice(0, 24)}`,
        notes: { snapshotId: snapshot.id, email: snapshot.email },
      });

      await prisma.abandonedCart.update({
        where: { id: snapshot.id },
        data: { razorpayOrderId: rzpOrder.id } as any,
      });

      return NextResponse.json({
        razorpayOrderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId,
        snapshotId: snapshot.id,
        // No orderNumber yet — created on /verify success
      });
    }

    // ─── Legacy path: order-based (kept for backward compatibility, but
    //     should not be hit by new clients after v26.3a is deployed) ─────
    if (orderNumber) {
      const order = await prisma.order.findUnique({ where: { orderNumber } });
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      if (order.paymentStatus === 'PAID') {
        return NextResponse.json({ error: 'Already paid' }, { status: 400 });
      }

      const rzpOrder = await rzp.orders.create({
        amount: order.total,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: { neejeeOrderId: order.id, orderNumber: order.orderNumber },
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: rzpOrder.id },
      });

      return NextResponse.json({
        razorpayOrderId: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId,
        orderNumber: order.orderNumber,
      });
    }

    return NextResponse.json({ error: 'snapshotId or orderNumber required' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Razorpay error' }, { status: 500 });
  }
}
