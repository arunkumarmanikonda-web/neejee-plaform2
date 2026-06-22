// Admin endpoint to push an order to Shiprocket and generate AWB
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { createShipment, generateAwb, shiprocketConfigured } from '@/lib/shiprocket';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!shiprocketConfigured()) {
    return NextResponse.json({
      error: 'Shiprocket not configured. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD env vars.',
      configured: false,
    }, { status: 400 });
  }

  try {
    const order = await prisma.order.findFirst({
      where: { OR: [{ orderNumber: params.id }, { id: params.id }] },
      include: {
        items: { include: { product: { select: { name: true, sku: true, hsnCode: true } }, variant: { select: { weight: true } } } },
        address: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const addr = order.address;
    if (!addr) return NextResponse.json({ error: 'Order has no shipping address' }, { status: 400 });

    const customerName = addr.name || order.user?.name || order.guestName || 'Customer';
    const customerEmail = order.user?.email || order.guestEmail || '';
    const customerPhone = addr.phone || '';

    // Sum item weights from variant (default 500g per item)
    const totalWeightKg = order.items.reduce((s, i) => {
      const w = (i as any).variant?.weight || 500;
      return s + (w * i.quantity) / 1000;
    }, 0) || 0.5;

    const ship = await createShipment({
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      customerName,
      customerEmail,
      customerPhone,
      billing: {
        address: [addr.line1, addr.line2].filter(Boolean).join(', '),
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
      },
      items: order.items.map(i => ({
        name: (i.product as any)?.name || 'Item',
        sku: (i.product as any)?.sku || i.productId,
        quantity: i.quantity,
        pricePaise: i.price,
        hsnCode: (i.product as any)?.hsnCode || undefined,
      })),
      subtotalPaise: order.subtotal,
      paymentMethod: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
      weight: totalWeightKg,
    });

    if (!ship.ok) {
      return NextResponse.json({ error: ship.error || 'Shiprocket create failed', raw: ship.raw }, { status: 500 });
    }

    // Try to generate AWB immediately
    let awbResult: any = null;
    if (ship.shipmentId) {
      awbResult = await generateAwb(ship.shipmentId);
    }

    const updateData: any = {};
    if (awbResult?.ok) {
      updateData.awbNumber = awbResult.awb;
      updateData.courier = awbResult.courier;
      updateData.trackingUrl = awbResult.trackingUrl;
      updateData.status = 'PACKED';
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.order.update({ where: { id: order.id }, data: updateData });
    }

    return NextResponse.json({
      success: true,
      shipment: ship,
      awb: awbResult,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
