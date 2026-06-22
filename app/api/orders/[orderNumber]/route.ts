// Public order fetch — limited info, used by /payment and /order-confirmation
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { orderNumber: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: params.orderNumber },
      select: {
        id: true, orderNumber: true, total: true, subtotal: true, shipping: true,
        discount: true, tax: true, paymentMethod: true, paymentStatus: true,
        status: true, createdAt: true, giftWrap: true, guestEmail: true, guestName: true,
        user: { select: { name: true, email: true, phone: true } },
        items: {
          include: { product: { select: { name: true, slug: true, images: true } } },
        },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
