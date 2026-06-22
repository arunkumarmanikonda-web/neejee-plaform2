// Customer orders endpoint — returns orders for the logged-in user
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Try DB first
  if (process.env.DATABASE_URL) {
    try {
      const orders = await prisma.order.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, slug: true, images: true },
              },
              variant: {
                select: { id: true, size: true, color: true },
              },
            },
          },
        },
      });

      return NextResponse.json({
        orders: orders.map((o: any) => ({
          id: o.orderNumber,
          dbId: o.id,
          date: o.createdAt,
          total: o.total,
          subtotal: o.subtotal,
          shipping: o.shipping,
          tax: o.tax,
          discount: o.discount,
          status: o.status,
          paymentStatus: o.paymentStatus,
          itemCount: o.items.length,
          items: o.items.map((it: any) => ({
            id: it.id,
            productId: it.productId,
            productName: it.product?.name ?? 'Product',
            productSlug: it.product?.slug ?? '',
            productImage: Array.isArray(it.product?.images) ? it.product.images[0] : null,
            variant: it.variant ? `${it.variant.size ?? ''} ${it.variant.color ?? ''}`.trim() : null,
            quantity: it.quantity,
            unitPrice: it.price,
            lineTotal: it.total,
          })),
        })),
        source: 'db',
      });
    } catch (e: any) {
      console.warn('[orders] DB failed:', e.message);
    }
  }

  // Fallback: empty list (no mock data leak)
  return NextResponse.json({ orders: [], source: 'fallback' });
}
