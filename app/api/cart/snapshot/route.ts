// Snapshot the user's cart server-side for abandoned-cart recovery.
// Called by checkout page when the user enters their email (step 1).
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidEmail } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, items, subtotal } = body;
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items' }, { status: 400 });
    }

    const session = await getSession();
    const userId = session?.id || null;

    // Upsert by email (latest snapshot replaces prior)
    const existing = await prisma.abandonedCart.findFirst({
      where: {
        email: email.toLowerCase(),
        recoveredOrderId: null,
        optedOut: false,
        createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }, // within 14 days
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.abandonedCart.update({
        where: { id: existing.id },
        data: {
          itemsJson: JSON.stringify(items).slice(0, 8000),
          subtotal: Math.round(subtotal || 0),
          itemCount: items.length,
          userId: userId || existing.userId,
        },
      });
    } else {
      await prisma.abandonedCart.create({
        data: {
          email: email.toLowerCase(),
          userId: userId || null,
          itemsJson: JSON.stringify(items).slice(0, 8000),
          subtotal: Math.round(subtotal || 0),
          itemCount: items.length,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 });
  }
}
