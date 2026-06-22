// app/api/checkout/route.ts
// v26.3a — Checkout correctness fix (NEEJEE-263)
//
// CRITICAL CHANGE FROM v26.2.x:
//   - COD path: Order is created here, ORDER_PLACED email fires here (UNCHANGED).
//   - PREPAID (Razorpay) path: NO ORDER CREATED HERE. Instead, an AbandonedCart
//     snapshot is written. Order is created ONLY by /api/razorpay/verify on
//     verified signature. ORDER_CONFIRMED email also fires only there.
//
// Why: before this fix, abandoning at the Razorpay modal left a real Order
// row in /admin/orders with status=PLACED, paymentStatus=PENDING, and the
// customer received an "Order received" email. That's wrong on both counts.
//
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { generateOrderNumber, calculateGST } from '@/lib/utils';
import { sendEmail, orderPlacedEmail } from '@/lib/email';
import { resolveShipping } from '@/lib/shipping/resolve';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GIFT_WRAP_PAISE = 15000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      items, contact, address,
      shipping = 'STANDARD',
      payment = 'RAZORPAY',
      giftWrap, personalNote, couponCode, gstinCustomer,
      utm, pointsToRedeem, phoneVerified,
    } = body;

    // ─── OTP gate (unchanged) ────────────────────────────────────────────
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

    const attribution = {
      utmSource: utm?.source || null,
      utmMedium: utm?.medium || null,
      utmCampaign: utm?.campaign || null,
      utmContent: utm?.content || null,
      utmTerm: utm?.term || null,
      referrer: utm?.referrer || null,
      landingPage: utm?.landingPage || null,
    };

    // ─── Validation (unchanged) ──────────────────────────────────────────
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items in order' }, { status: 400 });
    }
    if (!contact?.email || !contact?.phone) {
      return NextResponse.json({ error: 'Email/phone required' }, { status: 400 });
    }
    if (!address?.name || !address?.line1 || !address?.city || !address?.state || !address?.pincode) {
      return NextResponse.json({ error: 'Incomplete address' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(address.pincode)) {
      return NextResponse.json({ error: 'Invalid pincode' }, { status: 400 });
    }

    const session = guestSession;

    // ─── Price recomputation (unchanged) ─────────────────────────────────
    let subtotal = 0;
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

    for (const item of items) {
      const product: any = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true },
      });
      if (!product) return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 });
      if (product.status !== 'ACTIVE') return NextResponse.json({ error: `Product ${product.name} unavailable` }, { status: 400 });

      const now = new Date();
      let price = product.sellingPrice;
      if (product.salePrice && (!product.saleStartsAt || product.saleStartsAt <= now) && (!product.saleEndsAt || product.saleEndsAt >= now)) {
        price = product.salePrice;
      }

      let variantId: string | null = null;
      if (item.variantId) {
        const variant = product.variants.find((v: any) => v.id === item.variantId);
        if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 400 });
        if (variant.inventory < item.quantity) {
          return NextResponse.json({ error: `Only ${variant.inventory} left of ${product.name}` }, { status: 400 });
        }
        variantId = variant.id;
        if (variant.sellingPrice) price = variant.sellingPrice;
      } else if (product.variants.length > 0) {
        const v = product.variants.find((vv: any) => vv.inventory >= item.quantity);
        if (!v) return NextResponse.json({ error: `Out of stock: ${product.name}` }, { status: 400 });
        variantId = v.id;
      }

      const lineTotal = price * item.quantity;
      subtotal += lineTotal;
      verifiedItems.push({
        productId: product.id,
        variantId,
        quantity: item.quantity,
        price,
        total: lineTotal,
        name: product.name,
        craft: product.craft || null,
        region: product.region || null,
      });
    }

    const wrap = giftWrap ? GIFT_WRAP_PAISE : 0;

    const shippingResolved = await resolveShipping({
      pincode: address.pincode,
      state: address.state,
      subtotalPaise: subtotal,
      mode: shipping === 'EXPRESS' ? 'EXPRESS' : 'STANDARD',
    });
    const shippingPaise = shippingResolved.shippingPaise;

    // ─── Coupon (unchanged) ──────────────────────────────────────────────
    let discountPaise = 0;
    let appliedCouponId: string | null = null;
    if (couponCode) {
      const coupon = await prisma.coupon.findUnique({ where: { code: String(couponCode).toUpperCase() } });
      if (coupon && coupon.active) {
        const now = new Date();
        const datesOk = (!coupon.validFrom || coupon.validFrom <= now) && (!coupon.validTo || coupon.validTo >= now);
        const usageOk = !coupon.maxUses || coupon.usedCount < coupon.maxUses;
        const minOk = !coupon.minCart || subtotal >= coupon.minCart;
        const userOk = !coupon.userId || (session?.id && coupon.userId === session.id);

        let perUserOk = true;
        if (coupon.perUserOnce && session?.id) {
          const used = await prisma.couponRedemption.findUnique({
            where: { couponId_userId: { couponId: coupon.id, userId: session.id } },
          }).catch(() => null);
          if (used) perUserOk = false;
        }

        if (datesOk && usageOk && minOk && userOk && perUserOk) {
          if (coupon.type === 'PERCENT') {
            discountPaise = Math.round((subtotal * coupon.value) / 100);
            if (coupon.maxDiscount && discountPaise > coupon.maxDiscount) discountPaise = coupon.maxDiscount;
          } else if (coupon.type === 'FLAT') {
            discountPaise = Math.min(coupon.value, subtotal);
          }
          appliedCouponId = coupon.id;
        }
      }
    }

    // ─── Loyalty points (unchanged) ──────────────────────────────────────
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

    // =====================================================================
    // BRANCH: COD vs PREPAID
    // =====================================================================

    if (payment === 'COD') {
      // ─── COD path (unchanged behaviour) ─────────────────────────────────
      let addressId: string | null = null;
      if (session) {
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

      const orderNumber = generateOrderNumber();

      const order = await prisma.order.create({
        data: {
          orderNumber,
          userId: session?.id || null,
          addressId,
          guestEmail: session ? null : contact.email,
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
            create: verifiedItems.map(i => ({
              productId: i.productId,
              variantId: i.variantId || undefined,
              quantity: i.quantity,
              price: i.price,
              total: i.total,
            })),
          },
        },
      });

      // Coupon usage
      if (appliedCouponId) {
        await prisma.coupon.update({
          where: { id: appliedCouponId },
          data: { usedCount: { increment: 1 } },
        }).catch(e => console.warn('[checkout] coupon usedCount failed:', e.message));
        if (session?.id) {
          await prisma.couponRedemption.create({
            data: { couponId: appliedCouponId, userId: session.id, orderId: order.id },
          }).catch(e => console.warn('[checkout] couponRedemption write failed:', e.message));
        }
      }

      // Decrement inventory
      for (const v of verifiedItems) {
        if (v.variantId) {
          await prisma.variant.update({
            where: { id: v.variantId },
            data: { inventory: { decrement: v.quantity } },
          }).catch(e => console.warn('[checkout] variant decrement failed:', e.message));
        }
      }

      // Mark any pending abandoned cart as RECOVERED
      prisma.abandonedCart.updateMany({
        where: {
          email: contact.email.toLowerCase(),
          recoveredOrderId: null,
          optedOut: false,
        },
        data: { recoveredOrderId: order.id, recoveredAt: new Date() },
      }).catch(e => console.warn('[checkout] recovery mark failed:', e.message));

      // Fire ORDER_PLACED email (COD only)
      const orderForEmail = {
        ...order,
        customerName: address.name,
        items: verifiedItems.map(i => ({ ...i, subtotal: i.total })),
      };
      try {
        const { notify } = await import('@/lib/notifications');
        const recipients = order.userId
          ? { userId: order.userId }
          : { recipients: [{ email: contact.email, phone: contact.phone, name: contact.name }] };
        notify({
          event: 'ORDER_PLACED',
          ...recipients,
          data: {
            orderNumber: order.orderNumber,
            totalPaise: order.total,
            customerName: contact.name,
          },
          context: {
            type: 'ORDER',
            id: order.id,
            smsVars: {
              orderNumber: order.orderNumber,
              total: Math.round((order.total || 0) / 100).toString(),
            },
          } as any,
        }).catch(e => console.warn('[notify ORDER_PLACED]', e?.message));
      } catch (e: any) {
        console.warn('[checkout] notify failed:', e?.message);
        sendEmail({
          to: contact.email,
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

    // =====================================================================
    // PREPAID PATH — NO ORDER CREATED. Snapshot only.
    // =====================================================================

    // Persist a cart snapshot so /api/razorpay/verify can materialize it on
    // verified payment success. Also doubles as the abandonment row if the
    // customer never completes payment — cron will pick it up at T+1h.
    const snapshotJson = JSON.stringify({
      verifiedItems,
      contact,
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

    const snapshot = await prisma.abandonedCart.create({
      data: {
        email: contact.email.toLowerCase(),
        userId: session?.id || null,
        phone: contact.phone,
        customerName: address.name,
        itemsJson: snapshotJson,
        subtotal,
        itemCount: verifiedItems.reduce((s, i) => s + i.quantity, 0),
        paymentMethodPicked: 'PREPAID',
        lastSeenStep: 'payment',
        recoveryStage: 0,
        // grace period: cron will skip rows newer than abandonGraceMinutes
        nextActionAt: new Date(Date.now() + 60 * 60 * 1000), // T+1h default
      } as any,
    });

    return NextResponse.json({
      success: true,
      // No orderNumber yet — Razorpay flow uses snapshotId until verify
      snapshotId: snapshot.id,
      total,
      paymentMethod: 'RAZORPAY',
      next: 'payment',
    });
  } catch (e: any) {
    console.error('[checkout] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
