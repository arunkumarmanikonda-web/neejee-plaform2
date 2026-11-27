// Guest order lookup: order number + exact checkout email are required before
// issuing a tokenized invoice URL. Responses intentionally do not reveal which
// part of the lookup failed.
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { issueReturnAccess, RETURN_ACCESS_SECONDS, RETURN_COOKIE } from '@/lib/returns/guest-access';
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

    const actor = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
    const key = createHash('sha256').update('neejee-order-lookup:' + (actor || email)).digest('hex');
    const [limit] = await prisma.$queryRaw<Array<{allowed:boolean;retry_after:number}>>`
      select allowed, retry_after from private.record_auth_login_failure(${key}, 31, 900, 900)
    `;
    if (!limit?.allowed) {
      return NextResponse.json({error:'Too many lookups. Please try again later.'},
        {status:429,headers:{'Retry-After':String(Math.max(1,limit?.retry_after || 900))}});
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber },
      select: {
        id: true,
        userId: true,
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
    const guestReturnAccess = body.returns === true && order.userId === null;
    const response = NextResponse.json({
      guestReturnAccess,
      url: `/api/orders/${encodeURIComponent(order.orderNumber)}/invoice?token=${encodeURIComponent(token)}`,
      orderNumber: order.orderNumber,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
    if (guestReturnAccess) {
      response.cookies.set(RETURN_COOKIE, issueReturnAccess(order.id), {
        path: '/api/order-returns', maxAge: RETURN_ACCESS_SECONDS, httpOnly: true,
        secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      });
    }
    return response;
  } catch (error: any) {
    console.error('[orders.lookup] failed', { message: error?.message });
    return NextResponse.json({ error: 'Unable to look up this order right now' }, { status: 500 });
  }
}
