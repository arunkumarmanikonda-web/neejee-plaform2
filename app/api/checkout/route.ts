// app/api/checkout/route.ts
// Checkout integrity:
// - server recomputes price and eligibility
// - guest OTP policy remains server-authoritative
// - COD order + inventory/coupon/loyalty consumption are one transaction
// - prepaid checkout reserves inventory, coupon capacity, and loyalty points together
// - prepaid Order is still created only after verified Razorpay signature
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { generateOrderNumber, calculateGST } from '@/lib/utils';
import { sendEmail, orderPlacedEmail } from '@/lib/email';
import { resolveShipping } from '@/lib/shipping/resolve';
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

const GIFT_WRAP_PAISE = 15000;
const MAX_LINE_QUANTITY = 50;
const COD_MAX_PAISE = 2500000;

function safeCheckoutFailure(error: any) {
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

    let subtotal = 0;
    let allCodEligible = true;
    const verifiedItems: Array<{
      productId: string;
      variantId: string | null;
      quantity: number;
      price: number;
      total: number;
      name: string;
      craft?: string | null;
      region?: string | null;
    }> = [];

    for (const rawItem of items) {
      const productId = String(rawItem?.productId || '').trim();
      const quantity = Number(rawItem?.quantity);
      if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_LINE_QUANTITY) {
        return NextResponse.json({ error: 'Invalid cart quantity' }, { status: 400 });
      }

      const product: any = await prisma.product.findUnique({
        where: { id: productId },
        include: { variants: true },
      });
      if (!product) {
        return NextResponse.json({ error: 'A selected product could not be found' }, { status: 400 });
      }
      if (product.status !== 'ACTIVE') {
        return NextResponse.json({ error: `${product.name} is currently unavailable` }, { status: 409 });
      }
      if (product.codEligible === false) allCodEligible = false;

      const now = new Date();
      let price = Number(product.sellingPrice || 0);
      if (
        product.salePrice &&
        (!product.saleStartsAt || product.saleStartsAt <= now) &&
        (!product.saleEndsAt || product.saleEndsAt >= now)
      ) {
        price = Number(product.salePrice);
      }
      if (!Number.isInteger(price) || price < 0) {
        return NextResponse.json({ error: `${product.name} has invalid pricing` }, { status: 409 });
      }

      let variantId: string | null = null;
      if (rawItem.variantId) {
        const variant = product.variants.find((v: any) => v.id === rawItem.variantId);
        if (!variant) return NextResponse.json({ error: 'Selected variant not found' }, { status: 409 });
        if (variant.inventory < quantity) {
          return NextResponse.json({ error: `Only ${variant.inventory} left of ${product.name}`, code: 'INVENTORY_CHANGED' }, { status: 409 });
        }
        variantId = variant.id;
        if (variant.sellingPrice != null) price = Number(variant.sellingPrice);
      } else if (product.variants.length > 0) {
        const availableVariants = product.variants.filter((v: any) => v.inventory >= quantity);
        if (availableVariants.length !== 1) {
          return NextResponse.json({
            error: availableVariants.length === 0
              ? `Out of stock: ${product.name}`
              : `Please choose the exact option for ${product.name}`,
            code: availableVariants.length === 0 ? 'INVENTORY_CHANGED' : 'VARIANT_REQUIRED',
          }, { status: 409 });
        }
        variantId = availableVariants[0].id;
        if (availableVariants[0].sellingPrice != null) price = Number(availableVariants[0].sellingPrice);
      } else {
        return NextResponse.json({
          error: `${product.name} is not configured with a purchasable variant`,
          code: 'PRODUCT_UNAVAILABLE',
        }, { status: 409 });
      }

      const lineTotal = price * quantity;
      subtotal += lineTotal;
      verifiedItems.push({
        productId: product.id,
        variantId,
        quantity,
        price,
        total: lineTotal,
        name: product.name,
        craft: product.craft || null,
        region: product.region || null,
      });
    }

    const inventoryItems: ReservationItem[] = verifiedItems.map((item) => ({
      variantId: item.variantId!,
      quantity: item.quantity,
    }));

    const wrap = giftWrap ? GIFT_WRAP_PAISE : 0;
    const shippingResolved = await resolveShipping({
      pincode: address.pincode,
      state: address.state,
      subtotalPaise: subtotal,
      mode: shipping === 'EXPRESS' ? 'EXPRESS' : 'STANDARD',
    });
    let shippingPaise = shippingResolved.shippingPaise;

    let discountPaise = 0;
    let appliedCouponId: string | null = null;
    if (couponCode) {
      const normalizedCouponCode = String(couponCode).toUpperCase().trim();
      const coupon = await prisma.coupon.findUnique({ where: { code: normalizedCouponCode } });
      if (!coupon) {
        return NextResponse.json({ error: 'Coupon not found', code: 'COUPON_NOT_FOUND' }, { status: 400 });
      }
      if (!coupon.active) {
        return NextResponse.json({ error: 'Coupon is inactive', code: 'COUPON_INACTIVE' }, { status: 400 });
      }

      const now = new Date();
      if (coupon.validFrom && coupon.validFrom > now) {
        return NextResponse.json({ error: 'Coupon not yet active', code: 'COUPON_NOT_YET_ACTIVE' }, { status: 400 });
      }
      if (coupon.validTo && coupon.validTo < now) {
        return NextResponse.json({ error: 'Coupon has expired', code: 'COUPON_EXPIRED' }, { status: 400 });
      }
      if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
        return NextResponse.json({ error: 'Coupon usage limit reached', code: 'COUPON_USAGE_LIMIT' }, { status: 409 });
      }
      if (coupon.minCart != null && subtotal < coupon.minCart) {
        return NextResponse.json({
          error: `Minimum cart of ₹${(coupon.minCart / 100).toLocaleString('en-IN')} required`,
          code: 'COUPON_MIN_CART',
        }, { status: 400 });
      }
      if (coupon.userId) {
        if (!session?.id) {
          return NextResponse.json({ error: 'Please sign in to use this code', code: 'COUPON_SIGN_IN_REQUIRED' }, { status: 401 });
        }
        if (coupon.userId !== session.id) {
          return NextResponse.json({ error: 'This code belongs to another account', code: 'COUPON_WRONG_USER' }, { status: 403 });
        }
      }
      if (coupon.perUserOnce) {
        if (!session?.id) {
          return NextResponse.json({ error: 'Please sign in to use this one-time code', code: 'COUPON_SIGN_IN_REQUIRED' }, { status: 401 });
        }
        const used = await prisma.couponRedemption.findUnique({
          where: { couponId_userId: { couponId: coupon.id, userId: session.id } },
        }).catch(() => null);
        if (used) {
          return NextResponse.json({ error: 'You have already used this code', code: 'COUPON_ALREADY_USED' }, { status: 400 });
        }
      }

      if (coupon.type === 'PERCENT') {
        discountPaise = Math.round((subtotal * coupon.value) / 100);
        if (coupon.maxDiscount && discountPaise > coupon.maxDiscount) discountPaise = coupon.maxDiscount;
      } else if (coupon.type === 'FLAT') {
        discountPaise = Math.min(coupon.value, subtotal);
      } else if (coupon.type === 'FREE_SHIPPING') {
        shippingPaise = 0;
      }
      appliedCouponId = coupon.id;
    }

    let pointsRedeemed = 0;
    let pointsValuePaise = 0;
    if (pointsToRedeem && pointsToRedeem > 0 && session) {
      const { getCurrentBalance, getSettings } = await import('@/lib/loyalty');
      const [bal, lset] = await Promise.all([getCurrentBalance(session.id), getSettings()]);
      const subtotalForCap = subtotal + wrap + shippingPaise - discountPaise;
      const maxPaise = Math.floor(subtotalForCap * lset.maxRedemptionPct / 100);
      const maxPointsByCap = Math.floor(maxPaise / lset.redemptionValue);
      const requested = Math.max(0, parseInt(pointsToRedeem) || 0);
      pointsRedeemed = Math.min(requested, bal, maxPointsByCap);
      if (pointsRedeemed >= lset.minRedemption) {
        pointsValuePaise = pointsRedeemed * lset.redemptionValue;
      } else {
        pointsRedeemed = 0;
        pointsValuePaise = 0;
      }
    }

    const totalBeforeTax = subtotal + wrap + shippingPaise - discountPaise - pointsValuePaise;
    const tax = calculateGST(totalBeforeTax, 5);
    const total = totalBeforeTax;

    if (payment === 'COD') {
      if (!allCodEligible || total > COD_MAX_PAISE) {
        return NextResponse.json({
          error: !allCodEligible
            ? 'Cash on Delivery is not available for one or more selected pieces.'
            : 'Cash on Delivery is available only for eligible orders below ₹25,000.',
          code: 'COD_NOT_ELIGIBLE',
        }, { status: 400 });
      }

      const order = await prisma.$transaction(async (tx: any) => {
        await consumeUnreservedInventory(tx, inventoryItems);

        let addressId: string | null = null;
        if (session) {
          const addr = await tx.address.create({
            data: {
              userId: session.id,
              name: address.name,
              phone: contact.phone,
              line1: address.line1,
              line2: address.line2 || null,
              city: address.city,
              state: address.state,
              pincode: address.pincode,
              country: 'IN',
            },
          });
          addressId = addr.id;
        }

        const created = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            userId: session?.id || null,
            addressId,
            guestEmail: session ? null : normalizedEmail,
            guestName: session ? null : address.name,
            subtotal,
            shipping: shippingPaise,
            tax,
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

      return NextResponse.json({
        success: true,
        orderNumber: order.orderNumber,
        orderId: order.id,
        total,
        paymentMethod: 'COD',
        next: 'confirmation',
      });
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
    console.error('[checkout] error:', error);
    return safeCheckoutFailure(error);
  }
}
