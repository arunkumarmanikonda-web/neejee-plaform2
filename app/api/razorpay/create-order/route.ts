import { razorpayCredentials } from '@/lib/payments/razorpay-credentials';
// Creates a Razorpay order for a prepaid checkout snapshot.
// The NEEJEE Order is still materialized only after verified payment.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Razorpay from 'razorpay';
import { reserveInventory } from '@/lib/inventory/reservations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function inventoryChanged(error: any): boolean {
  const message = String(error?.message || '');
  return message.includes('INSUFFICIENT_INVENTORY') || message.includes('VARIANT_NOT_FOUND');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { snapshotId, orderNumber } = body;

    const { keyId, keySecret } = razorpayCredentials();
    if (!keyId || !keySecret) {
      const missing = [!keyId && 'RAZORPAY_KEY_ID', !keySecret && 'RAZORPAY_KEY_SECRET'].filter(Boolean);
      console.error('[razorpay.create-order] Missing payment configuration:', missing.join(', '));
      return NextResponse.json({ error: 'Payment service is temporarily unavailable' }, { status: 503 });
    }
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

    if (snapshotId) {
      const snapshot = await prisma.abandonedCart.findUnique({ where: { id: snapshotId } });
      if (!snapshot) return NextResponse.json({ error: 'Cart snapshot not found' }, { status: 404 });
      if (snapshot.recoveredOrderId) return NextResponse.json({ error: 'Already converted to order' }, { status: 409 });

      const data: any = snapshot.itemsJson ? JSON.parse(snapshot.itemsJson) : {};
      const verifiedItems = Array.isArray(data?.verifiedItems) ? data.verifiedItems : [];
      if (verifiedItems.length === 0) {
        return NextResponse.json({ error: 'Saved trunk has no verified items', code: 'SNAPSHOT_EMPTY' }, { status: 422 });
      }

      const reservationItems = verifiedItems
        .filter((item: any) => item?.variantId && Number.isInteger(Number(item?.quantity)) && Number(item.quantity) > 0)
        .map((item: any) => ({ variantId: String(item.variantId), quantity: Number(item.quantity) }));
      if (reservationItems.length !== verifiedItems.length) {
        return NextResponse.json({ error: 'A selected piece is no longer purchasable', code: 'PRODUCT_UNAVAILABLE' }, { status: 409 });
      }

      // Revalidate and refresh the hold immediately before opening Razorpay.
      try {
        await reserveInventory(prisma as any, snapshot.id, reservationItems, 30);
      } catch (error: any) {
        if (inventoryChanged(error)) {
          return NextResponse.json({
            error: 'One of your selected pieces is no longer available. Please return to your trunk.',
            code: 'INVENTORY_CHANGED',
          }, { status: 409 });
        }
        throw error;
      }

      const totalPaise = Number(data?.pricing?.total ?? snapshot.subtotal);
      if (!Number.isInteger(totalPaise) || totalPaise <= 0) {
        return NextResponse.json({ error: 'Invalid cart total' }, { status: 400 });
      }

      // Idempotent application behavior: reuse an already-linked gateway order.
      if (snapshot.razorpayOrderId) {
        return NextResponse.json({
          razorpayOrderId: snapshot.razorpayOrderId,
          amount: totalPaise,
          currency: 'INR',
          keyId,
          snapshotId: snapshot.id,
          reused: true,
        });
      }

      const rzpOrder = await rzp.orders.create({
        amount: totalPaise,
        currency: 'INR',
        receipt: `snap_${snapshot.id.slice(0, 24)}`,
        notes: { snapshotId: snapshot.id, email: snapshot.email },
      });

      const claim = await prisma.abandonedCart.updateMany({
        where: { id: snapshot.id, razorpayOrderId:null, recoveredOrderId:null },
        data: { razorpayOrderId: rzpOrder.id } as any,
      });

      const linked = claim.count ? rzpOrder.id : (await prisma.abandonedCart.findUnique({where:{id:snapshot.id},select:{razorpayOrderId:true,recoveredOrderId:true}}));
      const linkedId = typeof linked==='string' ? linked : (linked?.recoveredOrderId ? null : linked?.razorpayOrderId);
      if (!linkedId) return NextResponse.json({error:'Checkout already changed. Reload the order status.'},{status:409});
      return NextResponse.json({
        razorpayOrderId: linkedId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId,
        snapshotId: snapshot.id,
      });
    }

    // Legacy order-based path retained for old clients.
    if (orderNumber) {
      const order = await prisma.order.findUnique({ where: { orderNumber } });
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      if (['PAID','REFUNDED','PARTIALLY_REFUNDED'].includes(order.paymentStatus) || ['CANCELLED','CANCELLED_BUG','REFUNDED','RETURNED'].includes(order.status)) return NextResponse.json({ error: 'Already paid' }, { status: 409 });

      if (order.razorpayOrderId) {
        return NextResponse.json({
          razorpayOrderId: order.razorpayOrderId,
          amount: order.total,
          currency: 'INR',
          keyId,
          orderNumber: order.orderNumber,
          reused: true,
        });
      }

      const rzpOrder = await rzp.orders.create({
        amount: order.total,
        currency: 'INR',
        receipt: order.orderNumber,
        notes: { neejeeOrderId: order.id, orderNumber: order.orderNumber },
      });

      const claim = await prisma.order.updateMany({
        where: { id: order.id, razorpayOrderId:null, paymentStatus:{in:['PENDING','FAILED']} },
        data: { razorpayOrderId: rzpOrder.id },
      });

      const linked = claim.count ? rzpOrder.id : (await prisma.order.findUnique({where:{id:order.id},select:{razorpayOrderId:true,paymentStatus:true}}));
      const linkedId = typeof linked==='string' ? linked : (linked && ['PENDING','FAILED'].includes(linked.paymentStatus) ? linked.razorpayOrderId : null);
      if (!linkedId) return NextResponse.json({error:'Order already changed. Reload the order status.'},{status:409});
      return NextResponse.json({
        razorpayOrderId: linkedId,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        keyId,
        orderNumber: order.orderNumber,
      });
    }

    return NextResponse.json({ error: 'snapshotId or orderNumber required' }, { status: 400 });
  } catch (error: any) {
    if (Number(error?.statusCode) === 401) {
      console.error('[razorpay.create-order] Merchant authentication rejected (401)');
      return NextResponse.json({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        error: 'Online payment is temporarily unavailable. Your bag is saved. Please try again later.',
      }, { status: 503 });
    }
    console.error('[razorpay.create-order]', error);
    return NextResponse.json({ error: 'Unable to start payment right now' }, { status: 500 });
  }
}
