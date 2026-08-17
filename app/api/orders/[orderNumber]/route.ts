// Minimal bearer-reference order summary used by legacy payment flows.
// Order number is not authorization for customer identity data: never return
// email, phone, name, address, internal user ids, or line-item PII here.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: { orderNumber: string } }) {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: params.orderNumber },
      select: {
        orderNumber: true,
        total: true,
        subtotal: true,
        shipping: true,
        discount: true,
        tax: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        createdAt: true,
      },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (error: any) {
    console.error('[orders.public-summary] failed', { message: error?.message });
    return NextResponse.json({ error: 'Unable to load order summary' }, { status: 500 });
  }
}
