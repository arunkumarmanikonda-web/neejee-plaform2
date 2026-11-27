import { razorpayCredentials, liveCheckoutUnavailable } from '@/lib/payments/razorpay-credentials';
// Verify Razorpay signature, bind it to the exact stored gateway order,
// consume all checkout reservations, and materialize the paid NEEJEE Order atomically.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orderShippingAddress } from '@/lib/checkout/order-shipping-address';
import crypto from 'crypto';
import { captureState, fetchGatewayPayment } from '@/lib/payments/razorpay-settlement';
import { generateOrderNumber } from '@/lib/utils';
import {
  consumeInventoryReservation,
  consumeUnreservedInventory,
  releaseInventoryReservation,
} from '@/lib/inventory/reservations';
import {
  consumeCouponReservation,
  consumeLoyaltyReservation,
  redeemCouponNow,
  redeemLoyaltyPointsNow,
  releaseCouponReservation,
  releaseLoyaltyReservation,
} from '@/lib/checkout/reservations';
import { refundCapturedPayment } from '@/lib/payments/razorpay-refund';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type IntegrityRefundReason =
  | 'inventory_unavailable_after_hold'
  | 'coupon_unavailable_after_hold'
  | 'loyalty_unavailable_after_hold';

function errorMessage(error: any): string {
  return String(error?.message || '');
}

function isInventoryFailure(error: any): boolean {
  const message = errorMessage(error);
  return (
    message.includes('INVENTORY_UNAVAILABLE_AFTER_HOLD') ||
    message.includes('INVENTORY_CORRUPTION') ||
    message.includes('INSUFFICIENT_UNRESERVED_INVENTORY')
  );
}

function isMissingInventoryReservation(error: any): boolean {
  const message = errorMessage(error);
  return message.includes('RESERVATION_NOT_FOUND') && !message.includes('COUPON_') && !message.includes('LOYALTY_');
}

function integrityRefundReason(error: any): IntegrityRefundReason | null {
  const message = errorMessage(error);
  if (isInventoryFailure(error)) return 'inventory_unavailable_after_hold';
  if (
    message.includes('COUPON_USAGE_LIMIT') ||
    message.includes('COUPON_ALREADY_USED') ||
    message.includes('COUPON_RESERVATION_RELEASED') ||
    message.includes('COUPON_INACTIVE') ||
    message.includes('COUPON_EXPIRED') ||
    message.includes('COUPON_WRONG_USER')
  ) return 'coupon_unavailable_after_hold';
  if (
    message.includes('LOYALTY_UNAVAILABLE_AFTER_HOLD') ||
    message.includes('LOYALTY_INSUFFICIENT') ||
    message.includes('LOYALTY_RESERVATION_RELEASED')
  ) return 'loyalty_unavailable_after_hold';
  return null;
}

function refundResponse(reason: IntegrityRefundReason, refundId?: string | null) {
  if (reason === 'coupon_unavailable_after_hold') {
    return NextResponse.json({
      error: 'Your payment was received, but the coupon could no longer be honoured safely. A full refund has been initiated.',
      code: 'PAYMENT_REFUNDED_COUPON',
      refundId: refundId || null,
    }, { status: 409 });
  }
  if (reason === 'loyalty_unavailable_after_hold') {
    return NextResponse.json({
      error: 'Your payment was received, but the points reserved for this checkout were no longer available. A full refund has been initiated.',
      code: 'PAYMENT_REFUNDED_LOYALTY',
      refundId: refundId || null,
    }, { status: 409 });
  }
  return NextResponse.json({
    error: 'Your payment was received, but the piece became unavailable after the reservation window. A full refund has been initiated.',
    code: 'PAYMENT_REFUNDED_INVENTORY',
    refundId: refundId || null,
  }, { status: 409 });
}

async function confirmCapture(paymentId: string, orderId: string, total: number) {
  try {
    const payment = await fetchGatewayPayment(paymentId);
    const result = captureState(payment, paymentId, orderId, total);
    if (result === 'captured') return null;
    if (result === 'pending') return NextResponse.json({
      code:'PAYMENT_CAPTURE_PENDING', message:'Your bank has responded. We are waiting for Razorpay to confirm capture.',
    }, {status:202});
    return NextResponse.json({
      code:'PAYMENT_REVIEW', error:'This payment needs a status check. Please keep your payment reference.',
    }, {status:409});
  } catch {
    return NextResponse.json({code:'PAYMENT_CAPTURE_PENDING', message:'Payment confirmation is temporarily unavailable.'},{status:503});
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      snapshotId,
      orderNumber,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 });
    }
    if (!snapshotId && !orderNumber) {
      return NextResponse.json({ error: 'snapshotId or orderNumber required' }, { status: 400 });
    }

    const { keyId, keySecret: secret } = razorpayCredentials();
    if (liveCheckoutUnavailable(keyId)) {
      return NextResponse.json({ error: 'Payment verification is temporarily unavailable' }, { status: 503 });
    }
    if (!secret) {
      console.error('[razorpay.verify] RAZORPAY_KEY_SECRET is not configured');
      return NextResponse.json({ error: 'Payment verification is temporarily unavailable' }, { status: 503 });
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    const supplied = String(razorpay_signature);
    const signatureOk =
      expected.length === supplied.length &&
      crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(supplied, 'utf8'));

    if (!signatureOk) {
      console.warn('[razorpay.verify] invalid signature', {
        snapshotId: snapshotId || null,
        orderNumber: orderNumber || null,
        razorpayOrderId: razorpay_order_id,
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    if (snapshotId) {
      const snapshot = await prisma.abandonedCart.findUnique({ where: { id: snapshotId } });
      if (!snapshot) return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });

      if (!snapshot.razorpayOrderId || snapshot.razorpayOrderId !== razorpay_order_id) {
        return NextResponse.json({
          error: 'Payment does not match this checkout session',
          code: 'SNAPSHOT_RAZORPAY_ORDER_MISMATCH',
        }, { status: 409 });
      }

      // Historical recovery jobs also linked unrelated carts from the same email.
      // Only a matching gateway pair proves this particular checkout was settled.
      const settled = await prisma.order.findFirst({where:{razorpayOrderId:razorpay_order_id,razorpayPaymentId:razorpay_payment_id}});
      if (settled && ['PAID','REFUNDED','PARTIALLY_REFUNDED'].includes(settled.paymentStatus)) {
        return NextResponse.json({success:true,order:{orderNumber:settled.orderNumber},idempotent:true});
      }

      const data: any = snapshot.itemsJson ? JSON.parse(snapshot.itemsJson) : {};
      const verifiedItems = Array.isArray(data.verifiedItems) ? data.verifiedItems : [];
      if (verifiedItems.length === 0) {
        return NextResponse.json({ error: 'Saved checkout has no verified items', code: 'SNAPSHOT_EMPTY' }, { status: 422 });
      }

      const inventoryItems = verifiedItems
        .filter((item: any) => item?.variantId && Number.isInteger(Number(item?.quantity)) && Number(item.quantity) > 0)
        .map((item: any) => ({ variantId: String(item.variantId), quantity: Number(item.quantity) }));
      if (inventoryItems.length !== verifiedItems.length) {
        return NextResponse.json({ error: 'A paid item is not mapped to a purchasable variant', code: 'PRODUCT_UNAVAILABLE' }, { status: 409 });
      }

      const captureIssue = await confirmCapture(razorpay_payment_id,razorpay_order_id,Number(data.pricing?.total ?? snapshot.subtotal));
      if (captureIssue) return captureIssue;
      const contact = data.contact || {};
      const address = data.address || {};
      const pricing = data.pricing || {};
      const session = data.session || null;

      let order: any;
      let replay = false;
      try {
        order = await prisma.$transaction(async (tx: any) => {
          // A callback and its webhook can settle the same capture concurrently.
          // Keep the order, inventory changes and confirmation events single-use.
          await tx.$queryRaw`SELECT id FROM public."AbandonedCart" WHERE id = ${snapshot.id} FOR UPDATE`;
          const concurrent = await tx.order.findFirst({where:{razorpayOrderId:razorpay_order_id}});
          if (concurrent) {
            if (concurrent.razorpayPaymentId !== razorpay_payment_id) throw new Error('GATEWAY_ORDER_ALREADY_SETTLED');
            replay = true;
            return concurrent;
          }
          // Rollout compatibility: pre-reservation snapshots can still finalize
          // against genuinely unreserved stock.
          try {
            await consumeInventoryReservation(tx, snapshot.id);
          } catch (error: any) {
            if (!isMissingInventoryReservation(error)) throw error;
            await consumeUnreservedInventory(tx, inventoryItems);
          }

          const { id: addressId } = await tx.address.create({
            data: orderShippingAddress(session?.id, address, contact.phone),
            select: { id: true },
          });
          const created = await tx.order.create({
            data: {
              orderNumber: generateOrderNumber(),
              userId: session?.id || null,
              addressId,
              guestEmail: session?.id ? null : snapshot.email,
              guestName: session?.id ? null : snapshot.customerName,
              subtotal: pricing.subtotal ?? snapshot.subtotal,
              shipping: pricing.shipping || 0,
              tax: pricing.tax ?? 0,
              ...(pricing.checkoutTaxSnapshot ? {checkoutTaxSnapshot:pricing.checkoutTaxSnapshot} : {}),
              discount: pricing.discount || 0,
              total: pricing.total ?? snapshot.subtotal,
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
                create: verifiedItems.map((item: any) => ({
                  productId: item.productId,
                  variantId: item.variantId || undefined,
                  quantity: item.quantity,
                  price: item.price,
                  total: item.total,
                })),
              },
            },
          });

          if (data.appliedCouponId) {
            try {
              await consumeCouponReservation(tx, snapshot.id, created.id);
            } catch (error: any) {
              if (!errorMessage(error).includes('COUPON_RESERVATION_NOT_FOUND')) throw error;
              await redeemCouponNow(tx, {
                couponId: String(data.appliedCouponId),
                userId: session?.id || null,
                subtotalPaise: Number(pricing.subtotal ?? snapshot.subtotal ?? 0),
                orderId: created.id,
              });
            }
          }

          if (Number(pricing.pointsRedeemed || 0) > 0 && session?.id) {
            try {
              await consumeLoyaltyReservation(tx, snapshot.id, created.id);
            } catch (error: any) {
              if (!errorMessage(error).includes('LOYALTY_RESERVATION_NOT_FOUND')) throw error;
              await redeemLoyaltyPointsNow(tx, {
                userId: session.id,
                points: Number(pricing.pointsRedeemed),
                orderId: created.id,
              });
            }
          }

          await tx.abandonedCart.update({
            where: { id: snapshot.id },
            data: {
              recoveredOrderId: created.id,
              recoveredAt: new Date(),
              lastSeenStep: 'payment_confirmed',
            } as any,
          });

          return created;
        });
      } catch (error: any) {
        const reason = integrityRefundReason(error);
        if (reason) {
          console.error('[razorpay.verify] paid checkout reservation unavailable', {
            snapshotId: snapshot.id,
            paymentId: razorpay_payment_id,
            reason,
            message: errorMessage(error),
          });

          try {
            const refund = await refundCapturedPayment({
              paymentId: razorpay_payment_id,
              snapshotId: snapshot.id,
              reason,
            });
            await Promise.all([
              releaseInventoryReservation(prisma as any, snapshot.id, 'RELEASED').catch(() => 0),
              releaseCouponReservation(prisma as any, snapshot.id, 'RELEASED').catch(() => 0),
              releaseLoyaltyReservation(prisma as any, snapshot.id, 'RELEASED').catch(() => 0),
            ]);
            const label = reason.replace('_unavailable_after_hold', '');
            await prisma.abandonedCart.update({
              where: { id: snapshot.id },
              data: {
                lastSeenStep: `payment_refunded_${label}`,
                telecallerStatus: 'refund_initiated',
                telecallerNotes: `Automatic full refund ${refund.id || 'requested'} after ${label} checkout reservation could not be finalized.`,
              } as any,
            }).catch(() => {});

            return refundResponse(reason, refund.id || null);
          } catch (refundError: any) {
            console.error('[razorpay.verify] urgent refund failure', {
              snapshotId: snapshot.id,
              paymentId: razorpay_payment_id,
              reason,
              message: refundError?.message,
            });
            await prisma.abandonedCart.update({
              where: { id: snapshot.id },
              data: {
                lastSeenStep: 'payment_integrity_exception',
                telecallerStatus: 'urgent_payment_exception',
                telecallerNotes: `Payment ${razorpay_payment_id} captured; checkout finalization and automatic refund require urgent review (${reason}).`,
              } as any,
            }).catch(() => {});

            return NextResponse.json({
              error: 'Your payment was received, but the order needs manual attention. Our team has been alerted and will resolve it without requiring another payment.',
              code: 'PAYMENT_EXCEPTION',
            }, { status: 500 });
          }
        }

        console.error('[razorpay.verify] finalization retry required', {
          snapshotId: snapshot.id,
          paymentId: razorpay_payment_id,
          message: error?.message,
        });
        await prisma.abandonedCart.update({
          where: { id: snapshot.id },
          data: { lastSeenStep: 'payment_finalization_retry' } as any,
        }).catch(() => {});
        return NextResponse.json({
          error: 'Payment was received and order confirmation is still being finalized. Please retry confirmation; do not pay again.',
          code: 'PAYMENT_FINALIZATION_RETRY',
        }, { status: 503 });
      }

      if (replay) return NextResponse.json({success:true,order:{orderNumber:order.orderNumber},idempotent:true});
      await prisma.abandonedCart.updateMany({
        where: {
          email: snapshot.email,
          // Only marketing carts may be linked implicitly. Active checkout holds
          // store their own independent settlement record, even for the same email.
          OR:[{paymentMethodPicked:null},{paymentMethodPicked:{not:'PREPAID'}}],
          razorpayOrderId:null,
          recoveredOrderId: null,
          optedOut: false,
          id: { not: snapshot.id },
        },
        data: { recoveredOrderId: order.id, recoveredAt: new Date() },
      }).catch(() => {});

      try {
        const { processOrderForLoyalty } = await import('@/lib/loyalty');
        await processOrderForLoyalty(order.id);
      } catch (e: any) {
        console.warn('[verify] loyalty processing failed:', e.message);
      }

      try {
        const { postOrderToInvoice } = await import('@/lib/finance/post-order');
        await postOrderToInvoice(order.id);
      } catch (e: any) {
        console.warn('[verify] invoice posting failed:', e.message);
      }

      try {
        const { notify } = await import('@/lib/notifications');
        const { invoiceTokenFor } = await import('@/lib/finance/invoice-token');
        const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
        const invoiceUrl = `${base}/api/orders/${encodeURIComponent(order.orderNumber)}/invoice?token=${invoiceTokenFor(order.id)}`;
        await notify({
          event: 'ORDER_CONFIRMED',
          ...(session?.id
            ? { userId: session.id }
            : {
                recipients: [{
                  email: snapshot.email,
                  name: snapshot.customerName || undefined,
                  phone: snapshot.phone || undefined,
                }],
              }),
          data: {
            orderNumber: order.orderNumber,
            customerName: snapshot.customerName || 'friend',
            invoiceUrl,
            totalPaise: order.total,
          },
          context: { type: 'ORDER', id: order.id } as any,
        });
      } catch (e: any) {
        console.warn('[verify] confirmation notification failed:', e.message);
      }

      return NextResponse.json({ success: true, order:{orderNumber:order.orderNumber} });
    }

    // Legacy path retained only for older clients. A valid signature must also
    // match the exact Razorpay order stored on that NEEJEE Order.
    const existingLegacyOrder = await prisma.order.findUnique({ where: { orderNumber: orderNumber! } });
    if (!existingLegacyOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    if (!existingLegacyOrder.razorpayOrderId || existingLegacyOrder.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json({
        error: 'Payment does not match this order',
        code: 'LEGACY_RAZORPAY_ORDER_MISMATCH',
      }, { status: 409 });
    }

    if (['PAID','PARTIALLY_REFUNDED','REFUNDED'].includes(existingLegacyOrder.paymentStatus)) {
      if (existingLegacyOrder.razorpayPaymentId === razorpay_payment_id) return NextResponse.json({
        success:true,order:{orderNumber:existingLegacyOrder.orderNumber},idempotent:true,
      });
      return NextResponse.json({error:'This order already has a payment.',code:'PAYMENT_REVIEW'},{status:409});
    }
    const issue = await confirmCapture(razorpay_payment_id,razorpay_order_id,existingLegacyOrder.total);
    if (issue) return issue;
    const order = await prisma.$transaction(async tx => {
      const changed = await tx.order.updateMany({
        where:{id:existingLegacyOrder.id,razorpayOrderId:razorpay_order_id,paymentStatus:{in:['PENDING','FAILED']},status:{notIn:['CANCELLED','CANCELLED_BUG','REFUNDED','RETURNED']}},
        data:{paymentStatus:'PAID',razorpayPaymentId:razorpay_payment_id},
      });
      if (!changed.count) return null;
      await tx.order.updateMany({where:{id:existingLegacyOrder.id,status:'PLACED'},data:{status:'CONFIRMED'}});
      return tx.order.findUnique({where:{id:existingLegacyOrder.id}});
    });
    if (!order) {
      const current=await prisma.order.findUnique({where:{id:existingLegacyOrder.id}});
      if (current && current.razorpayPaymentId===razorpay_payment_id && ['PAID','PARTIALLY_REFUNDED','REFUNDED'].includes(current.paymentStatus)) {
        return NextResponse.json({success:true,order:{orderNumber:current.orderNumber},idempotent:true});
      }
      return NextResponse.json({error:'This order needs a payment status check.',code:'PAYMENT_REVIEW'},{status:409});
    }

    try {
      const { postOrderToInvoice } = await import('@/lib/finance/post-order');
      await postOrderToInvoice(order.id);
    } catch (e: any) {
      console.warn('[verify legacy] invoice posting failed:', e.message);
    }

    try {
      const { processOrderForLoyalty } = await import('@/lib/loyalty');
      await processOrderForLoyalty(order.id);
    } catch (e: any) {
      console.warn('[verify legacy] loyalty processing failed:', e.message);
    }

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
    } catch (e: any) {
      console.warn('[verify legacy] confirmation email failed:', e.message);
    }

    return NextResponse.json({ success: true, order:{orderNumber:order.orderNumber} });
  } catch (error: any) {
    console.error('[razorpay.verify]', error);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
