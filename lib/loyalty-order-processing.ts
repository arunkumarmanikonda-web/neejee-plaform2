import { prisma } from './prisma';
import {
  checkReferralReward,
  getSettings,
  sendTierUpNote,
  TIER_LABELS,
  TIER_ORDER,
  type LoyaltyTier,
} from './loyalty-legacy';
import { redeemLoyaltyPointsNow } from './checkout/reservations';

type AtomicOrderLoyaltyResult = {
  ok?: boolean;
  awarded?: boolean;
  reason?: string;
  userId?: string;
  orderId?: string;
  orderTotal?: number;
  points?: number;
  oldTier?: LoyaltyTier;
  newTier?: LoyaltyTier;
};

/**
 * Process paid-order loyalty under row locks in PostgreSQL.
 * Only the caller that actually awards the order performs tier/referral side effects.
 */
export async function processOrderForLoyalty(orderId: string): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ result: AtomicOrderLoyaltyResult }>>`
    select private.process_paid_order_loyalty(${orderId}) as result
  `;
  const result = rows?.[0]?.result;
  if (!result?.awarded || !result.userId) return;

  const oldTier = (result.oldTier || 'FOUND') as LoyaltyTier;
  const newTier = (result.newTier || oldTier) as LoyaltyTier;

  if (newTier !== oldTier && TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier)) {
    await sendTierUpNote(result.userId, oldTier, newTier).catch((error) =>
      console.warn('[loyalty] tier-up email failed:', error?.message),
    );
    try {
      const { notifyTierUp } = await import('./whatsapp');
      notifyTierUp(result.userId, TIER_LABELS[newTier]).catch(() => {});
    } catch {}
  }

  await checkReferralReward(
    result.userId,
    result.orderId || orderId,
    Number(result.orderTotal || 0),
  ).catch((error) => console.warn('[loyalty] referral reward failed:', error?.message));
}

/**
 * Concurrency-safe generic redemption for callers outside the checkout flow.
 * Checkout itself reserves points before payment and consumes that reservation.
 */
export async function redeemPoints(args: {
  userId: string;
  points: number;
  orderId: string;
}): Promise<{ ok: boolean; paiseValue: number; error?: string }> {
  const settings = await getSettings();
  const points = Math.max(0, Math.floor(Number(args.points) || 0));
  if (points < settings.minRedemption) {
    return { ok: false, paiseValue: 0, error: `Minimum redemption is ${settings.minRedemption} points` };
  }

  try {
    await redeemLoyaltyPointsNow(prisma as any, {
      userId: args.userId,
      points,
      orderId: args.orderId,
    });
    return { ok: true, paiseValue: points * settings.redemptionValue };
  } catch (error: any) {
    const message = String(error?.message || '');
    if (message.includes('LOYALTY_INSUFFICIENT')) {
      return { ok: false, paiseValue: 0, error: 'Insufficient available points' };
    }
    throw error;
  }
}
