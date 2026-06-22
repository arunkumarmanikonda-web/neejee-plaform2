// Release buyer info to seller(s) for an order.
// POST /api/admin/orders/{id}/release  body: { sellerId? }   — release for one or all sellers
//
// Effect: creates or updates SellerOrderRelease rows with releasedAt=now,
// then fires SELLER_ORDER_READY_TO_DISPATCH events with buyer info.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const onlySellerId: string | undefined = body.sellerId;

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: { select: { productId: true, product: { select: { sellerId: true } } } },
        address: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Group products by seller (only those with a seller — i.e. MARKETPLACE products)
    const bySeller: Record<string, string[]> = {};
    for (const it of order.items) {
      const sId = it.product?.sellerId;
      if (!sId) continue;
      if (onlySellerId && sId !== onlySellerId) continue;
      if (!bySeller[sId]) bySeller[sId] = [];
      if (!bySeller[sId].includes(it.productId)) bySeller[sId].push(it.productId);
    }
    if (Object.keys(bySeller).length === 0) {
      return NextResponse.json({ error: 'No marketplace sellers found on this order' }, { status: 400 });
    }

    const results: any[] = [];
    for (const [sellerId, productIds] of Object.entries(bySeller)) {
      const release = await prisma.sellerOrderRelease.upsert({
        where: { orderId_sellerId: { orderId: order.id, sellerId } },
        update: { releasedAt: new Date(), releasedByUserId: session!.id, productIds },
        create: {
          orderId: order.id,
          sellerId,
          productIds,
          releasedAt: new Date(),
          releasedByUserId: session!.id,
        },
      });
      results.push(release);

      // Notify the seller (owner)
      try {
        const seller = await prisma.seller.findUnique({
          where: { id: sellerId },
          select: { userId: true, businessName: true },
        });
        if (seller?.userId) {
          const { notify } = await import('@/lib/notifications');
          notify({
            event: 'SELLER_ORDER_READY_TO_DISPATCH',
            userId: seller.userId,
            data: {
              orderNumber: order.orderNumber,
              productCount: productIds.length,
            },
            context: { type: 'ORDER', id: order.id },
          }).catch(() => {});
        }
      } catch { /* */ }
    }

    return NextResponse.json({
      releases: results,
      message: `Released buyer info to ${results.length} seller(s)`,
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    console.error('[admin.order.release]', err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
