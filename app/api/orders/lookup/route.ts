// Guest order lookup: order number + exact checkout email are required before
// issuing a tokenized invoice URL. Responses intentionally do not reveal which
// part of the lookup failed.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceTokenFor } from '@/lib/finance/invoice-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NOT_FOUND = 'No order matches those details. Please double-check.';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderNumber = String(body.orderNumber || '').trim().toUpperCase();
    const email = String(body.email || '').trim().toLowerCase();

    if (!orderNumber || !email || orderNumber.length > 80 || email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Order number and a valid email are required' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        guestEmail: true,
        user: { select: { email: true } },
      },
    });

    const ownerEmail = String(order?.user?.email || order?.guestEmail || '').trim().toLowerCase();
    if (!order || !ownerEmail || ownerEmail !== email) {
      return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    }

    const token = invoiceTokenFor(order.id);
    return NextResponse.json({
      url: `/api/orders/${encodeURIComponent(order.orderNumber)}/invoice?token=${encodeURIComponent(token)}`,
      orderNumber: order.orderNumber,
    });
  } catch (error: any) {
    console.error('[orders.lookup] failed', { message: error?.message });
    return NextResponse.json({ error: 'Unable to look up this order right now' }, { status: 500 });
  }
}
