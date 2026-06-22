// Seller orders — items containing seller's products.
// Buyer details (name, phone, full address) are HIDDEN until admin marks the order
// "ready to dispatch" via SellerOrderRelease.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const sellerId = gate.ctx.seller.id;

  // 1) Pull all order items for this seller's products
  const items = await prisma.orderItem.findMany({
    where: { product: { sellerId } },
    orderBy: { id: 'desc' },
    take: 200,
    include: {
      product: { select: { id: true, name: true, slug: true, sku: true, images: true } },
      order: {
        select: {
          id: true, orderNumber: true, status: true, paymentStatus: true,
          createdAt: true, shippedAt: true, deliveredAt: true, courier: true, awbNumber: true,
          address: true,
          user: { select: { name: true, email: true } },
          guestName: true,
          guestEmail: true,
        },
      },
    },
  });

  // 2) Pull release rows so we know which orders have been opened up
  const orderIds = Array.from(new Set(items.map(it => it.order.id)));
  const releases = orderIds.length
    ? await prisma.sellerOrderRelease.findMany({
        where: { sellerId, orderId: { in: orderIds } },
      })
    : [];
  const releaseMap = new Map(releases.map(r => [r.orderId, r]));

  // 3) Group & redact buyer info per release state
  const grouped: Record<string, any> = {};
  for (const it of items) {
    const o = it.order;
    if (!grouped[o.id]) {
      const release = releaseMap.get(o.id);
      const isReleased = !!release?.releasedAt;
      const addr = o.address;

      grouped[o.id] = {
        orderId: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt,
        shippedAt: o.shippedAt,
        deliveredAt: o.deliveredAt,
        courier: o.courier,
        awbNumber: o.awbNumber,
        isReleased,
        releasedAt: release?.releasedAt || null,
        // Always show city/state (low-sensitivity, useful for the seller to plan packing)
        shipCity: addr?.city || null,
        shipState: addr?.state || null,
        // Hide PII until released
        buyer: isReleased ? {
          name: o.user?.name || o.guestName || addr?.name || null,
          email: o.user?.email || o.guestEmail || null,
          phone: addr?.phone || null,
        } : null,
        shipAddress: isReleased && addr ? {
          line1: addr.line1,
          line2: addr.line2,
          city: addr.city,
          state: addr.state,
          pincode: addr.pincode,
          country: addr.country,
        } : null,
        items: [],
        subtotalPaise: 0,
      };
    }
    grouped[o.id].items.push({
      id: it.id,
      productId: it.productId,
      productName: it.product.name,
      productImage: it.product.images?.[0],
      quantity: it.quantity,
      price: it.price,
      total: it.total,
    });
    grouped[o.id].subtotalPaise += it.total || 0;
  }

  const orders = Object.values(grouped).sort((a: any, b: any) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return NextResponse.json({ orders });
}
