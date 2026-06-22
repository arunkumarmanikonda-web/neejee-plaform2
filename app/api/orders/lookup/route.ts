// v23.40.25 — Guest order lookup. Given orderNumber + email, validates
// the match and returns a tokenized URL to view the order/invoice.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceTokenFor } from '@/lib/finance/invoice-token';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const orderNumber = String(body.orderNumber || '').trim().toUpperCase();
    const email = String(body.email || '').trim().toLowerCase();

    if (!orderNumber || !email) {
      return NextResponse.json({ error: 'Order number and email are required' }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber },
      select: { id: true, orderNumber: true, guestEmail: true, user: { select: { email: true } } },
    });

    if (!order) {
      return NextResponse.json({ error: 'No order matches those details. Please double-check.' }, { status: 404 });
    }

    const ownerEmail = (order.user?.email || order.guestEmail || '').toLowerCase();
    if (!ownerEmail || ownerEmail !== email) {
      // Don't tell the attacker WHY it failed; same response either way.
      return NextResponse.json({ error: 'No order matches those details. Please double-check.' }, { status: 404 });
    }

    const token = invoiceTokenFor(order.id);
    return NextResponse.json({
      url: `/api/orders/${encodeURIComponent(order.orderNumber)}/invoice?token=${token}`,
      orderNumber: order.orderNumber,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Lookup failed' }, { status: 500 });
  }
}
