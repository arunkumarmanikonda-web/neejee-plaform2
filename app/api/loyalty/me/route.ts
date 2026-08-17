// Customer loyalty summary. Never fabricates zero balances if the real loyalty
// query fails: the account UI handles a temporary 5xx state and retries.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  getCurrentBalance,
  getSettings,
  ensureReferralCode,
  TIER_LABELS,
  TIER_BLURBS,
  type LoyaltyTier,
} from '@/lib/loyalty';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function publicReferralName(name: string | null | undefined): string {
  const first = String(name || '').trim().split(/\s+/)[0];
  return first ? first.slice(0, 50) : 'Pending sign-up';
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        loyaltyTier: true,
        lifetimePoints: true,
        lifetimeSpend: true,
        referralCode: true,
      },
    });
    if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const [balance, settings, referralCode, ledger, referrals] = await Promise.all([
      getCurrentBalance(user.id),
      getSettings(),
      user.referralCode ? Promise.resolve(user.referralCode) : ensureReferralCode(user.id),
      prisma.loyaltyLedger.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          type: true,
          points: true,
          reason: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      prisma.referral.findMany({
        where: { referrerId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          status: true,
          createdAt: true,
          rewardedAt: true,
          referee: { select: { name: true } },
        },
      }),
    ]);

    const tier = user.loyaltyTier as LoyaltyTier;
    let nextTier: LoyaltyTier | null = null;
    let nextThreshold = 0;
    if (tier === 'FOUND') { nextTier = 'KNOWN'; nextThreshold = settings.thresholdKnown; }
    else if (tier === 'KNOWN') { nextTier = 'PERSONAL'; nextThreshold = settings.thresholdPersonal; }
    else if (tier === 'PERSONAL') { nextTier = 'FAMILY'; nextThreshold = settings.thresholdFamily; }

    const progressPct = nextTier && nextThreshold > 0
      ? Math.min(100, Math.max(0, Math.round((user.lifetimeSpend / nextThreshold) * 100)))
      : 100;
    const spendToNext = nextTier ? Math.max(0, nextThreshold - user.lifetimeSpend) : 0;

    const pending = referrals.filter((referral) => referral.status === 'PENDING').length;
    const qualified = referrals.filter((referral) => referral.status === 'QUALIFIED').length;
    const rewarded = referrals.filter((referral) => referral.status === 'REWARDED').length;
    const pointsEarned = rewarded * settings.referralRewardPoints;

    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
        tier,
        tierLabel: TIER_LABELS[tier],
        tierBlurb: TIER_BLURBS[tier],
        points: balance,
        lifetimePoints: user.lifetimePoints,
        lifetimeSpend: user.lifetimeSpend,
        referralCode,
      },
      progress: {
        nextTier,
        nextTierLabel: nextTier ? TIER_LABELS[nextTier] : null,
        nextThreshold,
        spendToNext,
        progressPct,
      },
      ledger,
      referrals: {
        total: referrals.length,
        pending,
        qualified,
        rewarded,
        pointsEarned,
        list: referrals.map((referral) => ({
          id: referral.id,
          status: referral.status,
          pointsAwarded: referral.status === 'REWARDED' ? settings.referralRewardPoints : 0,
          createdAt: referral.createdAt,
          rewardedAt: referral.rewardedAt,
          refereeName: publicReferralName(referral.referee?.name),
        })),
      },
      settings: {
        paisePerPoint: settings.paisePerPoint,
        redemptionValue: settings.redemptionValue,
        minRedemption: settings.minRedemption,
        maxRedemptionPct: settings.maxRedemptionPct,
        referralRewardPoints: settings.referralRewardPoints,
        refereeDiscountPct: settings.refereeDiscountPct,
      },
    });
  } catch (error: any) {
    console.error('[loyalty.me] failed', { userId: session.id, message: error?.message });
    return NextResponse.json(
      { error: "Founder's Circle is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
