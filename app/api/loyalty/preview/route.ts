// Preview how many points the user can apply to a given cart subtotal.
// Returns max usable points, current balance, and rupee value.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getCurrentBalance, getSettings } from '@/lib/loyalty';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ canRedeem: false, reason: 'not-logged-in' });

  try {
    const { subtotal } = await request.json();
    const sub = Math.max(0, parseInt(subtotal) || 0);
    if (sub === 0) return NextResponse.json({ canRedeem: false, reason: 'empty-cart' });

    const [balance, settings] = await Promise.all([
      getCurrentBalance(session.id),
      getSettings(),
    ]);

    if (balance < settings.minRedemption) {
      return NextResponse.json({
        canRedeem: false,
        reason: 'below-minimum',
        balance,
        minRedemption: settings.minRedemption,
      });
    }

    // Max usable = min(balance, points equivalent to maxRedemptionPct of subtotal)
    const maxPaiseRedeemable = Math.floor(sub * settings.maxRedemptionPct / 100);
    const maxPointsByCap = Math.floor(maxPaiseRedeemable / settings.redemptionValue);
    const maxUsable = Math.min(balance, maxPointsByCap);

    return NextResponse.json({
      canRedeem: maxUsable >= settings.minRedemption,
      balance,
      maxUsable,
      maxPaiseValue: maxUsable * settings.redemptionValue,
      redemptionValue: settings.redemptionValue,
      minRedemption: settings.minRedemption,
      maxRedemptionPct: settings.maxRedemptionPct,
    });
  } catch (e: any) {
    return NextResponse.json({ canRedeem: false, error: e.message }, { status: 200 });
  }
}
