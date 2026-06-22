// lib/notifications/order-events.ts
// v26.3b — Central dispatcher for order lifecycle SMS + WhatsApp.
//
// Called from:
//   - /api/checkout (COD order placed)
//   - /api/razorpay/verify (prepaid order confirmed)
//   - /api/admin/orders/[id] (status changes by admin)
//   - /api/webhooks/shiprocket (auto status flips)
//
// Email is NOT handled here — existing lib/email.ts pipelines handle the
// branded HTML emails. This module strictly fires the SMS and WA channels.

import { prisma } from '@/lib/prisma';
import { dispatchSms, dispatchWhatsApp } from './dispatcher';
import type { NotificationEvent } from './types';

function firstName(name: string | null | undefined): string {
  if (!name) return 'friend';
  return name.split(' ')[0] || 'friend';
}

function rupees(paise: number | null | undefined): string {
  if (!paise) return '0';
  return Math.round(paise / 100).toLocaleString('en-IN');
}

/**
 * Fire the right notifications for a single order event.
 * Reads the Order + items + user/guest to assemble template variables.
 * Skips silently if recipient missing for a channel.
 */
export async function fireOrderEvent(opts: {
  orderId: string;
  event: NotificationEvent;
  extra?: Record<string, string>;  // e.g. { awbNumber: '...', courier: 'Delhivery' }
}) {
  const order = await prisma.order.findUnique({
    where: { id: opts.orderId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      address: { select: { phone: true, name: true } },
      items: {
        include: {
          product: { select: { name: true, craft: true, region: true } },
        },
      },
    },
  });
  if (!order) return { ok: false, error: 'Order not found' };

  // Resolve recipient + name
  const phone =
    (order.user as any)?.phone ||
    (order.address as any)?.phone ||
    null;
  const customerName =
    order.user?.name ||
    order.guestName ||
    (order.address as any)?.name ||
    null;
  const userId = order.userId;

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
  const trackLink = `${base}/orders/${encodeURIComponent(order.orderNumber)}`;
  const itemsSummary = order.items.slice(0, 3)
    .map((i: any) => `${i.quantity}× ${i.product?.name || 'item'}`).join(', ');

  // Common variables across all events
  const baseVars: Record<string, string> = {
    firstName: firstName(customerName),
    orderNumber: order.orderNumber,
    totalRupees: rupees(order.total),
    trackLink,
  };

  switch (opts.event) {
    // ────────────────────────────────────────────────────────────
    case 'ORDER_PLACED': {
      const smsVars = { ...baseVars };
      const waVars = {
        ...baseVars,
        itemsSummary: itemsSummary || `${order.items.length} item(s)`,
        paymentMethod: order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online (Paid)',
      };

      const sms = phone ? dispatchSms({
        event: 'ORDER_PLACED',
        recipient: phone,
        variables: smsVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ ok: false, skipped: 'no phone' });

      const wa = phone ? dispatchWhatsApp({
        event: 'ORDER_PLACED',
        recipient: phone,
        variables: waVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ ok: false, skipped: 'no phone' });

      const [smsRes, waRes] = await Promise.allSettled([sms, wa]);
      return { ok: true, sms: smsRes, wa: waRes };
    }

    // ────────────────────────────────────────────────────────────
    case 'ORDER_SHIPPED': {
      const awbNumber = opts.extra?.awbNumber || order.awbNumber || '';
      const courier   = opts.extra?.courier || order.courier || 'Courier partner';
      const expectedDelivery = opts.extra?.expectedDelivery || 'in 4-5 days';
      const trackLinkShipped = order.trackingUrl || `${base}/track/${awbNumber}`;

      const smsVars = { ...baseVars, awbNumber, courier, trackLink: trackLinkShipped };
      const waVars = { ...baseVars, awbNumber, courier, expectedDelivery };

      const sms = phone ? dispatchSms({
        event: 'ORDER_SHIPPED', recipient: phone, variables: smsVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ skipped: true });
      const wa = phone ? dispatchWhatsApp({
        event: 'ORDER_SHIPPED', recipient: phone, variables: waVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ skipped: true });
      const [s, w] = await Promise.allSettled([sms, wa]);
      return { ok: true, sms: s, wa: w };
    }

    // ────────────────────────────────────────────────────────────
    case 'ORDER_OUT_FOR_DELIVERY': {
      const awbNumber = opts.extra?.awbNumber || order.awbNumber || '';
      const smsVars = { firstName: baseVars.firstName, orderNumber: baseVars.orderNumber };
      const waVars  = { ...smsVars, awbNumber };
      const sms = phone ? dispatchSms({
        event: 'ORDER_OUT_FOR_DELIVERY', recipient: phone, variables: smsVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ skipped: true });
      const wa = phone ? dispatchWhatsApp({
        event: 'ORDER_OUT_FOR_DELIVERY', recipient: phone, variables: waVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ skipped: true });
      const [s, w] = await Promise.allSettled([sms, wa]);
      return { ok: true, sms: s, wa: w };
    }

    // ────────────────────────────────────────────────────────────
    case 'ORDER_DELIVERED': {
      const smsVars = { firstName: baseVars.firstName, orderNumber: baseVars.orderNumber };
      const sms = phone ? dispatchSms({
        event: 'ORDER_DELIVERED', recipient: phone, variables: smsVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ skipped: true });
      const wa = phone ? dispatchWhatsApp({
        event: 'ORDER_DELIVERED', recipient: phone, variables: smsVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ skipped: true });
      const [s, w] = await Promise.allSettled([sms, wa]);
      return { ok: true, sms: s, wa: w };
    }

    // ────────────────────────────────────────────────────────────
    case 'ORDER_CANCELLED': {
      const refundRupees = opts.extra?.refundRupees || rupees(order.total);
      const refundMethod = opts.extra?.refundMethod || (order.paymentMethod === 'COD' ? 'N/A (COD)' : 'Original payment method');
      const refundEta    = opts.extra?.refundEta || '5-7 working days';

      const smsVars = { ...baseVars, refundRupees };
      const waVars  = { ...baseVars, refundRupees, refundMethod, refundEta };
      const sms = phone ? dispatchSms({
        event: 'ORDER_CANCELLED', recipient: phone, variables: smsVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ skipped: true });
      const wa = phone ? dispatchWhatsApp({
        event: 'ORDER_CANCELLED', recipient: phone, variables: waVars,
        userId, orderId: order.id,
      }) : Promise.resolve({ skipped: true });
      const [s, w] = await Promise.allSettled([sms, wa]);
      return { ok: true, sms: s, wa: w };
    }

    default:
      return { ok: false, error: `Unsupported event: ${opts.event}` };
  }
}
