// Shiprocket tracking webhook.
// Shiprocket's configured security token is delivered in the `x-api-key`
// header. Reject unsigned traffic before reading or acting on the payload.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyShiprocketWebhook, webhookSecretConfigured } from '@/lib/webhooks/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SHIPROCKET_STATUS_MAP: Record<string, string> = {
  'PICKED UP': 'SHIPPED',
  'IN TRANSIT': 'SHIPPED',
  'OUT FOR DELIVERY': 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  UNDELIVERED: 'SHIPPED',
  CANCELED: 'CANCELLED',
  CANCELLED: 'CANCELLED',
  'RTO INITIATED': 'CANCELLED',
  'RTO DELIVERED': 'CANCELLED',
};

const EVENT_MAP: Record<string, string> = {
  SHIPPED: 'ORDER_SHIPPED',
  OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
  DELIVERED: 'ORDER_DELIVERED',
  CANCELLED: 'ORDER_CANCELLED',
};

export async function POST(req: Request) {
  if (!webhookSecretConfigured(process.env.SHIPROCKET_WEBHOOK_TOKEN)) {
    console.error('[webhooks.shiprocket] SHIPROCKET_WEBHOOK_TOKEN not configured');
    return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 });
  }
  if (!verifyShiprocketWebhook(req)) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const awb = String(body?.awb || body?.awb_code || '').trim();
    const shiprocketStatus = String(body?.current_status || body?.status || '').trim().toUpperCase();
    const ourStatus = SHIPROCKET_STATUS_MAP[shiprocketStatus];

    if (!awb || !ourStatus) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const order = await prisma.order.findFirst({
      where: { awbNumber: awb },
      select: {
        id: true,
        status: true,
        awbNumber: true,
        courier: true,
        shippedAt: true,
        deliveredAt: true,
      },
    });
    if (!order) return NextResponse.json({ ok: true, ignored: true });

    const progress = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const currentIdx = progress.indexOf(order.status);
    const nextIdx = progress.indexOf(ourStatus);

    if (order.status === ourStatus) return NextResponse.json({ ok: true, idempotent: true });
    if (nextIdx >= 0 && currentIdx > nextIdx) {
      return NextResponse.json({ ok: true, ignored: true });
    }
    // A delivery confirmation is terminal for courier progression. Do not let a
    // stale or late cancellation/RTO event reverse it automatically.
    if (order.status === 'DELIVERED' && ourStatus === 'CANCELLED') {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const updateData: any = { status: ourStatus };
    if (ourStatus === 'SHIPPED') {
      if (!order.courier) updateData.courier = body?.courier_name || body?.courier || null;
      if (!order.shippedAt) updateData.shippedAt = new Date();
    }
    if (ourStatus === 'DELIVERED' && !order.deliveredAt) updateData.deliveredAt = new Date();

    await prisma.order.update({ where: { id: order.id }, data: updateData });

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
      } catch (error: any) {
        console.warn('[webhooks.shiprocket] notification failed:', error?.message);
      }
    }

    return NextResponse.json({ ok: true, status: ourStatus });
  } catch (error: any) {
    console.warn('[webhooks.shiprocket] processing failed:', error?.message);
    // Acknowledge authenticated provider traffic to avoid retry storms.
    return NextResponse.json({ ok: true, suppressed: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: webhookSecretConfigured(process.env.SHIPROCKET_WEBHOOK_TOKEN) });
}
