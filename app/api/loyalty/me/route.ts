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
  TIER_ORDER,
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
    const [user, settings] = await Promise.all([
      prisma.user.findUnique({
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
      }),
      getSettings(),
    ]);
    if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const referralCode = user.referralCode || await ensureReferralCode(user.id);
    const [balance, ledger, recentReferrals, referralCounts] = await Promise.all([
      getCurrentBalance(user.id),
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
          pointsAwarded: true,
          createdAt: true,
          rewardedAt: true,
          referee: { select: { name: true } },
        },
      }),
      prisma.referral.groupBy({
        where: { referrerId: user.id },
        by: ['status'],
        _count: { _all: true },
        _sum: { pointsAwarded: true },
      }),
    ]);

    const tier = user.loyaltyTier as LoyaltyTier;
    const tierIdx = TIER_ORDER.indexOf(tier);
    const nextTier = tierIdx >= 0 && tierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[tierIdx + 1] : null;
    let nextThreshold = 0;
    if (nextTier === 'KNOWN') nextThreshold = settings.thresholdKnown;
    else if (nextTier === 'PERSONAL') nextThreshold = settings.thresholdPersonal;
    else if (nextTier === 'FAMILY') nextThreshold = settings.thresholdFamily;
    const progressPct = nextTier && nextThreshold > 0
      ? Math.min(100, Math.max(0, Math.round((user.lifetimeSpend / nextThreshold) * 100)))
      : 100;
    const spendToNext = nextTier ? Math.max(0, nextThreshold - user.lifetimeSpend) : 0;

    const counts = new Map(referralCounts.map((row) => [String(row.status), row._count._all]));
    const totalReferrals = referralCounts.reduce((sum, row) => sum + row._count._all, 0);
    const pointsEarned = referralCounts.reduce(
      (sum, row) => sum + (row.status === 'REWARDED' ? Number(row._sum.pointsAwarded || 0) : 0),
      0,
    );

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
        total: totalReferrals,
        pending: counts.get('PENDING') || 0,
        qualified: counts.get('QUALIFIED') || 0,
        rewarded: counts.get('REWARDED') || 0,
        pointsEarned,
        list: recentReferrals.map((referral) => ({
          id: referral.id,
          status: referral.status,
          pointsAwarded: referral.pointsAwarded,
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
