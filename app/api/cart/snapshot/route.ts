// Snapshot the user's cart server-side for abandoned-cart recovery.
// Called by checkout page while the customer is still in checkout.
// v26.3b — store a structured payload using verifiedItems so recovery,
// payment snapshot display, and cron all read the same shape.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      items,
      subtotal,
      contact,
      address,
      paymentMethodPicked,
      step,
    } = body;

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items' }, { status: 400 });
    }

    const session = await getSession();
    const userId = session?.id || null;

    const payload = {
      verifiedItems: items,
      contact: contact || null,
      address: address || null,
      pricing: {
        subtotal: Math.round(subtotal || 0),
      },
    };

    const itemsJson = JSON.stringify(payload).slice(0, 8000);
    const itemCount = items.reduce(
      (sum: number, item: any) => sum + Math.max(1, Number(item?.quantity || 1)),
      0
    );

    const existing = await prisma.abandonedCart.findFirst({
      where: {
        email: email.toLowerCase(),
        recoveredOrderId: null,
        optedOut: false,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.abandonedCart.update({
        where: { id: existing.id },
        data: {
          itemsJson,
          subtotal: Math.round(subtotal || 0),
          itemCount,
          userId: userId || existing.userId,
          customerName: address?.name || (existing as any).customerName || null,
          phone: contact?.phone || (existing as any).phone || null,
          paymentMethodPicked: paymentMethodPicked || (existing as any).paymentMethodPicked || null,
          lastSeenStep: step || (existing as any).lastSeenStep || null,
        } as any,
      });
    } else {
      await prisma.abandonedCart.create({
        data: {
          email: email.toLowerCase(),
          userId: userId || null,
          customerName: address?.name || null,
          phone: contact?.phone || null,
          itemsJson,
          subtotal: Math.round(subtotal || 0),
          itemCount,
          paymentMethodPicked: paymentMethodPicked || null,
          lastSeenStep: step || null,
        } as any,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}
