// app/api/checkout/route.ts
// Checkout integrity:
// - server recomputes price and eligibility
// - guest OTP policy remains server-authoritative
// - COD order + inventory/coupon/loyalty consumption are one transaction
// - prepaid checkout reserves inventory, coupon capacity, and loyalty points together
// - prepaid Order is still created only after verified Razorpay signature
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { orderShippingAddress } from '@/lib/checkout/order-shipping-address';
import { codAttemptKey, codRequestHash, confirmedCodOrder, findCodAttempt } from '@/lib/checkout/cod-attempt';
import { getSession } from '@/lib/auth';
import { generateOrderNumber } from '@/lib/utils';
import { sendEmail, orderPlacedEmail } from '@/lib/email';
import { calculateCheckoutPricing, CheckoutPricingError } from '@/lib/checkout/pricing';
import {
  consumeUnreservedInventory,
  reserveInventory,
  type ReservationItem,
} from '@/lib/inventory/reservations';
import {
  redeemCouponNow,
  redeemLoyaltyPointsNow,
  reserveCoupon,
  reserveLoyaltyPoints,
} from '@/lib/checkout/reservations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


function safeCheckoutFailure(error: any) {
  if (error instanceof CheckoutPricingError) return NextResponse.json(error.detail, {status:error.status});
  const message = String(error?.message || '');
  if (
    message.includes('INSUFFICIENT_INVENTORY') ||
    message.includes('INSUFFICIENT_UNRESERVED_INVENTORY')
  ) {
    return NextResponse.json(
      { error: 'One of your selected pieces was just reserved or sold. Please review your trunk and try again.', code: 'INVENTORY_CHANGED' },
      { status: 409 },
    );
  }
  if (
    message.includes('VARIANT_NOT_FOUND') ||
    message.includes('NO_VARIANTS_TO_RESERVE') ||
    message.includes('NO_VARIANTS_TO_CONSUME')
  ) {
    return NextResponse.json(
      { error: 'One of your selected pieces is not currently available for checkout.', code: 'PRODUCT_UNAVAILABLE' },
      { status: 409 },
    );
  }
  if (message.includes('COUPON_SIGN_IN_REQUIRED')) {
    return NextResponse.json(
      { error: 'Please sign in to use this coupon.', code: 'COUPON_SIGN_IN_REQUIRED' },
      { status: 401 },
    );
  }
  if (
    message.includes('COUPON_USAGE_LIMIT') ||
    message.includes('COUPON_ALREADY_USED') ||
    message.includes('COUPON_ALREADY_RESERVED') ||
    message.includes('COUPON_EXPIRED') ||
    message.includes('COUPON_INACTIVE') ||
    message.includes('COUPON_WRONG_USER') ||
    message.includes('COUPON_MIN_CART')
  ) {
    return NextResponse.json(
      { error: 'This coupon can no longer be applied to this checkout. Please review your code and try again.', code: 'COUPON_CHANGED' },
      { status: 409 },
    );
  }
  if (message.includes('LOYALTY_INSUFFICIENT')) {
    return NextResponse.json(
      { error: 'Your available Founder’s Circle points changed before checkout completed. Please review the points applied and try again.', code: 'LOYALTY_CHANGED' },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: 'Unable to complete checkout right now.' }, { status: 500 });
}

export async function POST(request: Request) {
  let attempt: { key: string; hash: string } | null = null;
  async function replay() {
    if (!attempt) return null;
    const existing = await findCodAttempt(attempt.key);
    if (!existing) return null;
    if (existing.codRequestHash !== attempt.hash) {
      return NextResponse.json({ error: 'This checkout has already been used with different details. Check the earlier order before starting another.', code: 'COD_ATTEMPT_CONFLICT' }, { status: 409 });
    }
    return NextResponse.json(confirmedCodOrder(existing));
  }
  try {
    const body = await request.json();
    const {
      items,
      contact,
      address,
      shipping = 'STANDARD',
      payment = 'RAZORPAY',
      giftWrap,
      personalNote,
      couponCode,
      gstinCustomer,
      utm,
      pointsToRedeem,
      phoneVerified,
    } = body;

    if (!['STANDARD', 'EXPRESS'].includes(String(shipping))) {
      return NextResponse.json({ error: 'Invalid shipping method' }, { status: 400 });
    }
    if (!['RAZORPAY', 'COD'].includes(String(payment))) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    const guestSession = await getSession();
    const header = request.headers.get('Idempotency-Key');
    if (payment === 'COD' && header !== null) {
      const key = codAttemptKey(header);
      if (!key) return NextResponse.json({ error: 'Invalid checkout attempt.' }, { status: 400 });
      attempt = { key, hash: codRequestHash(body, guestSession?.id) };
      const confirmed = await replay();
      if (confirmed) return confirmed;
    }
    if (process.env.CHECKOUT_OTP_REQUIRED === 'true' && !guestSession) {
      if (!phoneVerified || !contact?.phone) {
        return NextResponse.json({
          error: 'Phone verification required for guest checkout',
          code: 'OTP_REQUIRED',
        }, { status: 401 });
      }
      const { normalizePhone } = await import('@/lib/phone');
      const normalized = normalizePhone(contact.phone) || contact.phone;
      const recent = await prisma.otpCode.findFirst({
        where: {
          phone: normalized,
          purpose: 'checkout_guest',
          consumedAt: { gte: new Date(Date.now() - 10 * 60 * 1000), not: null },
        },
        orderBy: { consumedAt: 'desc' },
      });
      if (!recent) {
        return NextResponse.json({
          error: 'Phone verification expired. Please verify your number again.',
          code: 'OTP_EXPIRED',
        }, { status: 401 });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 });
    }
    if (!contact?.email || !contact?.phone) {
      return NextResponse.json({ error: 'Email and phone are required' }, { status: 400 });
    }
    const normalizedEmail = String(contact.email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (!address?.name || !address?.line1 || !address?.city || !address?.state || !address?.pincode) {
      return NextResponse.json({ error: 'Incomplete address' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(String(address.pincode))) {
      return NextResponse.json({ error: 'Invalid pincode' }, { status: 400 });
    }

    try {
      orderShippingAddress(guestSession?.id, address, contact.phone);
    } catch {
      return NextResponse.json({ error: 'Enter a complete delivery address and mobile number.' }, { status: 400 });
    }

    const session = guestSession;
    const attribution = {
      utmSource: utm?.source || null,
      utmMedium: utm?.medium || null,
      utmCampaign: utm?.campaign || null,
      utmContent: utm?.content || null,
      utmTerm: utm?.term || null,
      referrer: utm?.referrer || null,
      landingPage: utm?.landingPage || null,
    };

    const pricing = await calculateCheckoutPricing({items, address, shipping, giftWrap, couponCode, pointsToRedeem}, session);
    const {subtotal, wrap, shippingPaise, discountPaise, appliedCouponId, pointsRedeemed, pointsValuePaise,
      total, tax, allCodEligible, codAvailable, verifiedItems} = pricing;
    if (body.expectedTotal !== undefined && body.expectedTotal !== total) {
      return NextResponse.json({error:'Your checkout total changed. Review the updated total before placing your order.',code:'QUOTE_CHANGED'}, {status:409});
    }
    const inventoryItems: ReservationItem[] = verifiedItems.map(item => ({ variantId:item.variantId!, quantity:item.quantity }));

    if (payment === 'COD') {
      if (!codAvailable) {
        return NextResponse.json({
          error: !allCodEligible
            ? 'Cash on Delivery is not available for one or more selected pieces.'
            : 'Cash on Delivery is available only for eligible orders below ₹25,000.',
          code: 'COD_NOT_ELIGIBLE',
        }, { status: 400 });
      }

      const order = await prisma.$transaction(async (tx: any) => {
        const { id: addressId } = await tx.address.create({
          data: orderShippingAddress(session?.id, address, contact.phone),
          select: { id: true },
        });
        const created = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            ...(attempt ? { codAttemptKey: attempt.key, codRequestHash: attempt.hash } : {}),
            userId: session?.id || null,
            addressId,
            guestEmail: session ? null : normalizedEmail,
            guestName: session ? null : address.name,
            subtotal,
            shipping: shippingPaise,
            tax,
            checkoutTaxSnapshot: pricing.checkoutTaxSnapshot,
            discount: discountPaise,
            total,
            pointsRedeemed,
            pointsValue: pointsValuePaise,
            paymentMethod: 'COD',
            paymentStatus: 'PENDING' as any,
            giftWrap: !!giftWrap,
            personalNote: personalNote || null,
            gstinCustomer: gstinCustomer || null,
            source: 'WEB',
            ...attribution,
            items: {
              create: verifiedItems.map((item) => ({
                productId: item.productId,
                variantId: item.variantId || undefined,
                quantity: item.quantity,
                price: item.price,
                total: item.total,
              })),
            },
          },
        });

        await consumeUnreservedInventory(tx, inventoryItems);
        if (appliedCouponId) {
          await redeemCouponNow(tx, {
            couponId: appliedCouponId,
            userId: session?.id || null,
            subtotalPaise: subtotal,
            orderId: created.id,
          });
        }
        if (pointsRedeemed > 0 && session?.id) {
          await redeemLoyaltyPointsNow(tx, {
            userId: session.id,
            points: pointsRedeemed,
            orderId: created.id,
          });
        }

        return created;
      });

      prisma.abandonedCart.updateMany({
        where: {
          email: normalizedEmail,
          OR:[{paymentMethodPicked:null},{paymentMethodPicked:{not:'PREPAID'}}],
          razorpayOrderId:null,
          recoveredOrderId: null,
          optedOut: false,
        },
        data: { recoveredOrderId: order.id, recoveredAt: new Date() },
      }).catch((e) => console.warn('[checkout] recovery mark failed:', e.message));

      const orderForEmail = {
        ...order,
        customerName: address.name,
        items: verifiedItems.map((item) => ({ ...item, subtotal: item.total })),
      };

      try {
        const { notify } = await import('@/lib/notifications');
        const recipients = order.userId
          ? { userId: order.userId }
          : { recipients: [{ email: normalizedEmail, phone: contact.phone, name: address.name }] };
        await notify({
          event: 'ORDER_PLACED',
          ...recipients,
          data: {
            orderNumber: order.orderNumber,
            totalPaise: order.total,
            customerName: address.name,
          },
          context: {
            type: 'ORDER',
            id: order.id,
            smsVars: {
              orderNumber: order.orderNumber,
              total: Math.round((order.total || 0) / 100).toString(),
            },
          } as any,
        });
      } catch (e: any) {
        console.warn('[checkout] notify failed:', e?.message);
        sendEmail({
          to: normalizedEmail,
          subject: `Order received — ${order.orderNumber}`,
          html: orderPlacedEmail(orderForEmail),
        }).catch(() => {});
      }

      return NextResponse.json(confirmedCodOrder(order));
    }

    const snapshotJson = JSON.stringify({
      verifiedItems,
      contact: { ...contact, email: normalizedEmail },
      address,
      pricing: {
        subtotal,
        shipping: shippingPaise,
        tax,
        discount: discountPaise,
        wrap,
        checkoutTaxSnapshot: pricing.checkoutTaxSnapshot,
        pointsRedeemed,
        pointsValuePaise,
        total,
      },
      giftWrap: !!giftWrap,
      personalNote: personalNote || null,
      gstinCustomer: gstinCustomer || null,
      appliedCouponId,
      attribution,
      session: session ? { id: session.id } : null,
    });

    const { snapshot, reservation } = await prisma.$transaction(async (tx: any) => {
      const snapshot = await tx.abandonedCart.create({
        data: {
          email: normalizedEmail,
          userId: session?.id || null,
          phone: contact.phone,
          customerName: address.name,
          itemsJson: snapshotJson,
          subtotal,
          itemCount: verifiedItems.reduce((sum, item) => sum + item.quantity, 0),
          paymentMethodPicked: 'PREPAID',
          lastSeenStep: 'payment',
          recoveryStage: 0,
          nextActionAt: new Date(Date.now() + 60 * 60 * 1000),
        } as any,
      });

      const reservation = await reserveInventory(tx, snapshot.id, inventoryItems, 30);
      if (appliedCouponId) {
        await reserveCoupon(tx, {
          snapshotId: snapshot.id,
          couponId: appliedCouponId,
          userId: session?.id || null,
          subtotalPaise: subtotal,
          holdMinutes: 30,
        });
      }
      if (pointsRedeemed > 0 && session?.id) {
        await reserveLoyaltyPoints(tx, {
          snapshotId: snapshot.id,
          userId: session.id,
          points: pointsRedeemed,
          holdMinutes: 30,
        });
      }
      return { snapshot, reservation };
    });

    return NextResponse.json({
      success: true,
      snapshotId: snapshot.id,
      total,
      paymentMethod: 'RAZORPAY',
      next: 'payment',
      reservationExpiresAt: reservation?.expiresAt || null,
    });
  } catch (error: any) {
    // An overlapping placement can commit between the first read and pricing, or
    // while this transaction waits on the unique attempt key. Its receipt wins.
    if (attempt) {
      try { const confirmed = await replay(); if (confirmed) return confirmed; }
      catch { /* Surface the original checkout failure. */ }
    }
    console.error('[checkout] error:', error);
    return safeCheckoutFailure(error);
  }
}
