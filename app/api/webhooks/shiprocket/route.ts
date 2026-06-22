// app/api/webhooks/shiprocket/route.ts
// v26.3b — Shiprocket tracking webhook skeleton.
//
// Configure in Shiprocket dashboard → Settings → Webhooks:
//   URL: https://www.neejee.com/api/webhooks/shiprocket
//   Events: tick "Shipment status updates"
//
// Shiprocket POSTs tracking events. We map their status codes to our
// OrderStatus enum, update the order, and fire matching notifications.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SHIPROCKET_STATUS_MAP: Record<string, string> = {
  // Shiprocket statuses → our OrderStatus enum values
  'PICKED UP':         'SHIPPED',
  'IN TRANSIT':        'SHIPPED',
  'OUT FOR DELIVERY':  'OUT_FOR_DELIVERY',
  'DELIVERED':         'DELIVERED',
  'UNDELIVERED':       'SHIPPED',           // keep, attempt redelivery
  'CANCELED':          'CANCELLED',
  'CANCELLED':         'CANCELLED',
  'RTO INITIATED':     'CANCELLED',
  'RTO DELIVERED':     'CANCELLED',
};

const EVENT_MAP: Record<string, string> = {
  SHIPPED:           'ORDER_SHIPPED',
  OUT_FOR_DELIVERY:  'ORDER_OUT_FOR_DELIVERY',
  DELIVERED:         'ORDER_DELIVERED',
  CANCELLED:         'ORDER_CANCELLED',
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Shiprocket payload typically has:
    //   { awb, order_id, current_status, scans: [...], ... }
    const awb = String(body?.awb || body?.awb_code || '');
    const shiprocketStatus = String(body?.current_status || body?.status || '').toUpperCase();
    const ourStatus = SHIPROCKET_STATUS_MAP[shiprocketStatus];

    if (!awb || !ourStatus) {
      return NextResponse.json({ ok: true, ignored: 'unmapped status or no AWB' });
    }

    // Find order by AWB
    const order = await prisma.order.findFirst({
      where: { awbNumber: awb },
      select: { id: true, status: true, awbNumber: true, courier: true },
    });
    if (!order) {
      return NextResponse.json({ ok: true, ignored: 'no order for AWB' });
    }

    // Idempotency: if status already matches or is "downstream", skip
    const order_progress = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const currentIdx = order_progress.indexOf(order.status);
    const newIdx = order_progress.indexOf(ourStatus);
    if (newIdx >= 0 && currentIdx > newIdx) {
      return NextResponse.json({ ok: true, ignored: 'already past this status' });
    }

    // Update order
    const updateData: any = { status: ourStatus };
    if (ourStatus === 'SHIPPED' && !order.courier) updateData.courier = body?.courier_name || body?.courier;
    if (ourStatus === 'DELIVERED') updateData.deliveredAt = new Date();
    if (ourStatus === 'SHIPPED' && !updateData.shippedAt) updateData.shippedAt = new Date();

    await prisma.order.update({ where: { id: order.id }, data: updateData });

    // Fire notifications
    const event = EVENT_MAP[ourStatus];
    if (event) {
      try {
        const { fireOrderEvent } = await import('@/lib/notifications/order-events');
        await fireOrderEvent({
          orderId: order.id,
          event: event as any,
          extra: {
            awbNumber: awb,
            courier: body?.courier_name || body?.courier || order.courier || 'Courier partner',
          },
        });
      } catch (e: any) {
        console.warn('[webhooks.shiprocket] fireOrderEvent failed:', e?.message);
      }
    }

    return NextResponse.json({ ok: true, status: ourStatus });
  } catch (e: any) {
    console.warn('[webhooks.shiprocket]', e?.message);
    return NextResponse.json({ ok: true, suppressed: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'shiprocket-webhook' });
}
