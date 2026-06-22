// app/api/razorpay/verify/route.ts
// v26.3a — Verify Razorpay signature AND CREATE the NEEJEE Order here.
//
// Behavior change:
//   - Accepts { snapshotId, razorpay_order_id, razorpay_payment_id, razorpay_signature }.
//   - On valid signature: reads the AbandonedCart snapshot, creates the Order,
//     decrements inventory, marks the snapshot as recovered, fires the
//     ORDER_CONFIRMED email (this is now the ONLY place that does so for
//     prepaid orders), runs loyalty + finance posting.
//   - Legacy support: if { orderNumber } is passed (COD-style precreated
//     order), behaves as before.
//
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { generateOrderNumber, calculateGST } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      snapshotId,
      orderNumber, // legacy
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
    }
    if (!snapshotId && !orderNumber) {
      return NextResponse.json({ error: 'snapshotId or orderNumber required' }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || '';

    // ─── Signature verification ─────────────────────────────────────────
    let signatureOk = false;
    if (secret) {
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      signatureOk = expected === razorpay_signature;
    } else {
      // Dev mode — accept without signature
      console.warn('[razorpay.verify] DEV MODE — no RAZORPAY_KEY_SECRET, accepting');
      signatureOk = true;
    }

    if (!signatureOk) {
      // Mark snapshot or order as failed
      if (snapshotId) {
        await prisma.abandonedCart.update({
          where: { id: snapshotId },
          data: { lastSeenStep: 'payment_failed' } as any,
        }).catch(() => {});
      }
      if (orderNumber) {
        await prisma.order.update({
          where: { orderNumber },
          data: { paymentStatus: 'FAILED' },
        }).catch(() => {});
      }
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // =====================================================================
    // NEW PATH: snapshot → create Order
    // =====================================================================
    if (snapshotId) {
      const snapshot = await prisma.abandonedCart.findUnique({
        where: { id: snapshotId },
      });
      if (!snapshot) {
        return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
      }
      if (snapshot.recoveredOrderId) {
        // Idempotent: already converted. Return the existing order.
        const existing = await prisma.order.findUnique({
          where: { id: snapshot.recoveredOrderId },
        });
        return NextResponse.json({ success: true, order: existing, idempotent: true });
      }

      const data: any = snapshot.itemsJson ? JSON.parse(snapshot.itemsJson) : {};
      const verifiedItems = data.verifiedItems || [];
      const contact = data.contact || {};
      const address = data.address || {};
      const pricing = data.pricing || {};
      const session = data.session || null;

      // Create address row (if logged in user)
      let addressId: string | null = null;
      if (session?.id) {
        const addr = await prisma.address.create({
          data: {
            userId: session.id,
            name: address.name, phone: contact.phone,
            line1: address.line1, line2: address.line2 || null,
            city: address.city, state: address.state, pincode: address.pincode,
            country: 'IN',
          },
        });
        addressId = addr.id;
      }

      const orderNumberNew = generateOrderNumber();

      const order = await prisma.order.create({
        data: {
          orderNumber: orderNumberNew,
          userId: session?.id || null,
          addressId,
          guestEmail: session?.id ? null : snapshot.email,
          guestName: session?.id ? null : snapshot.customerName,
          subtotal: pricing.subtotal || snapshot.subtotal,
          shipping: pricing.shipping || 0,
          tax: pricing.tax || 0,
          discount: pricing.discount || 0,
          total: pricing.total || snapshot.subtotal,
          pointsRedeemed: pricing.pointsRedeemed || 0,
          pointsValue: pricing.pointsValuePaise || 0,
          paymentMethod: 'RAZORPAY',
          paymentStatus: 'PAID' as any,
          status: 'CONFIRMED',
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          giftWrap: !!data.giftWrap,
          personalNote: data.personalNote || null,
          gstinCustomer: data.gstinCustomer || null,
          source: 'WEB',
          utmSource: data.attribution?.utmSource || null,
          utmMedium: data.attribution?.utmMedium || null,
          utmCampaign: data.attribution?.utmCampaign || null,
          utmContent: data.attribution?.utmContent || null,
          utmTerm: data.attribution?.utmTerm || null,
          referrer: data.attribution?.referrer || null,
          landingPage: data.attribution?.landingPage || null,
          items: {
            create: verifiedItems.map((i: any) => ({
              productId: i.productId,
              variantId: i.variantId || undefined,
              quantity: i.quantity,
              price: i.price,
              total: i.total,
            })),
          },
        },
      });

      // Decrement inventory
      for (const v of verifiedItems) {
        if (v.variantId) {
          await prisma.variant.update({
            where: { id: v.variantId },
            data: { inventory: { decrement: v.quantity } },
          }).catch(e => console.warn('[verify] variant decrement failed:', e.message));
        }
      }

      // Coupon redemption
      if (data.appliedCouponId) {
        await prisma.coupon.update({
          where: { id: data.appliedCouponId },
          data: { usedCount: { increment: 1 } },
        }).catch(() => {});
        if (session?.id) {
          await prisma.couponRedemption.create({
            data: { couponId: data.appliedCouponId, userId: session.id, orderId: order.id },
          }).catch(() => {});
        }
      }

      // Mark snapshot as RECOVERED
      await prisma.abandonedCart.update({
        where: { id: snapshot.id },
        data: {
          recoveredOrderId: order.id,
          recoveredAt: new Date(),
        },
      }).catch(e => console.warn('[verify] snapshot recovery mark failed:', e.message));

      // Also catch any OTHER abandoned carts for this email (older sessions)
      await prisma.abandonedCart.updateMany({
        where: {
          email: snapshot.email,
          recoveredOrderId: null,
          optedOut: false,
          id: { not: snapshot.id },
        },
        data: { recoveredOrderId: order.id, recoveredAt: new Date() },
      }).catch(() => {});

      // Points debit
      if (pricing.pointsRedeemed > 0 && session?.id) {
        try {
          const { redeemPoints } = await import('@/lib/loyalty');
          await redeemPoints({
            userId: session.id,
            points: pricing.pointsRedeemed,
            orderId: order.id,
          });
        } catch (e: any) { console.warn('[verify] points debit failed:', e.message); }
      }

      // Loyalty earn (idempotent)
      try {
        const { processOrderForLoyalty } = await import('@/lib/loyalty');
        await processOrderForLoyalty(order.id);
      } catch (e: any) { console.warn('[verify] loyalty processing failed:', e.message); }

      // Auto-post to revenue ledger
      try {
        const { postOrderToInvoice } = await import('@/lib/finance/post-order');
        await postOrderToInvoice(order.id);
      } catch (e: any) { console.warn('[verify] invoice posting failed:', e.message); }

      // ─── ORDER_CONFIRMED email (ONLY here for prepaid) ───────────────
      try {
        const { notify } = await import('@/lib/notifications');
        const { invoiceTokenFor } = await import('@/lib/finance/invoice-token');
        const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
        const invoiceUrl = `${base}/api/orders/${encodeURIComponent(order.orderNumber)}/invoice?token=${invoiceTokenFor(order.id)}`;
        const recipientEmail = snapshot.email;
        await notify({
          event: 'ORDER_CONFIRMED',
          ...(session?.id
            ? { userId: session.id }
            : { recipients: [{ email: recipientEmail, name: snapshot.customerName || undefined, phone: snapshot.phone || undefined }] }),
          data: {
            orderNumber: order.orderNumber,
            customerName: snapshot.customerName || 'friend',
            invoiceUrl,
            totalPaise: order.total,
          },
          context: { type: 'ORDER', id: order.id } as any,
        });
      } catch (e: any) { console.warn('[verify] confirmation email failed:', e.message); }

      return NextResponse.json({ success: true, order });
    }

    // =====================================================================
    // LEGACY PATH: orderNumber → update existing order (COD path or legacy)
    // =====================================================================
    const order = await prisma.order.update({
      where: { orderNumber: orderNumber! },
      data: {
        paymentStatus: 'PAID',
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        status: 'CONFIRMED',
      },
    });

    try {
      const { postOrderToInvoice } = await import('@/lib/finance/post-order');
      await postOrderToInvoice(order.id);
    } catch (e: any) { console.warn('[verify legacy] invoice posting failed:', e.message); }

    try {
      const { processOrderForLoyalty } = await import('@/lib/loyalty');
      await processOrderForLoyalty(order.id);
    } catch (e: any) { console.warn('[verify legacy] loyalty processing failed:', e.message); }

    try {
      const { notify } = await import('@/lib/notifications');
      const { invoiceTokenFor } = await import('@/lib/finance/invoice-token');
      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { user: { select: { id: true, email: true, name: true } } },
      });
      const recipientEmail = fullOrder?.user?.email || fullOrder?.guestEmail;
      const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
      const invoiceUrl = `${base}/api/orders/${encodeURIComponent(order.orderNumber)}/invoice?token=${invoiceTokenFor(order.id)}`;
      if (recipientEmail) {
        await notify({
          event: 'ORDER_CONFIRMED',
          ...(fullOrder?.userId
            ? { userId: fullOrder.userId }
            : { recipients: [{ email: recipientEmail, name: fullOrder?.guestName || undefined }] }),
          data: {
            orderNumber: order.orderNumber,
            customerName: fullOrder?.user?.name || fullOrder?.guestName || 'friend',
            invoiceUrl,
          },
        });
      }
    } catch (e: any) { console.warn('[verify legacy] confirmation email failed:', e.message); }

    return NextResponse.json({ success: true, order });
  } catch (e: any) {
    console.error('[razorpay.verify]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
