// Returns only non-PII snapshot information needed by the payment page.
// The snapshot id is a checkout bearer reference, not an authorization mechanism
// for customer identity data.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseSnapshot(itemsJson: string) {
  try {
    const data = JSON.parse(itemsJson || '{}');
    const verifiedItems = Array.isArray(data?.verifiedItems) ? data.verifiedItems : [];
    return { data, verifiedItems };
  } catch {
    return { data: null, verifiedItems: [] };
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const cart: any = await (prisma.abandonedCart.findUnique as any)({
      where: { id: params.id },
      select: {
        id: true,
        subtotal: true,
        itemCount: true,
        recoveredOrderId: true,
        itemsJson: true,
      },
    });

    if (!cart) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (cart.recoveredOrderId) return NextResponse.json({ error: 'Already converted' }, { status: 410 });

    const { data, verifiedItems } = parseSnapshot(cart.itemsJson);
    if (verifiedItems.length === 0) {
      return NextResponse.json({
        ok: false,
        code: 'snapshot_empty_items',
        message: 'Snapshot has no verified items',
      }, { status: 410 });
    }

    const total =
      typeof data?.pricing?.total === 'number' && data.pricing.total > 0
        ? data.pricing.total
        : cart.subtotal;
    const itemCount =
      verifiedItems.reduce((sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0) ||
      cart.itemCount;

    return NextResponse.json({
      snapshot: {
        id: cart.id,
        total,
        itemCount,
      },
    });
  } catch (error: any) {
    console.error('[checkout.snapshot]', error?.message);
    return NextResponse.json({ error: 'Unable to load payment summary' }, { status: 500 });
  }
}
