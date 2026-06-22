// Logged-in customer's loyalty dashboard data
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getCurrentBalance, getSettings, tierForSpend, ensureReferralCode, TIER_LABELS, TIER_BLURBS, TIER_ORDER, type LoyaltyTier } from '@/lib/loyalty';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [user, settings, balance, ledger, referrals] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.id },
        select: {
          id: true, name: true, email: true,
          loyaltyTier: true, loyaltyPoints: true, lifetimePoints: true, lifetimeSpend: true,
          referralCode: true,
        },
      }),
      getSettings(),
      getCurrentBalance(session.id),
      prisma.loyaltyLedger.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      prisma.referral.findMany({
        where: { referrerId: session.id },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: {
          referee: { select: { name: true, email: true } },
        },
      }),
    ]);

    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Ensure referral code exists
    const referralCode = user.referralCode || await ensureReferralCode(user.id);

    // Compute progress to next tier
    const tier = user.loyaltyTier as LoyaltyTier;
    const tierIdx = TIER_ORDER.indexOf(tier);
    const nextTier = tierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[tierIdx + 1] : null;
    let nextThreshold = 0;
    if (nextTier === 'KNOWN') nextThreshold = settings.thresholdKnown;
    else if (nextTier === 'PERSONAL') nextThreshold = settings.thresholdPersonal;
    else if (nextTier === 'FAMILY') nextThreshold = settings.thresholdFamily;
    const progressPct = nextTier && nextThreshold > 0
      ? Math.min(100, Math.round((user.lifetimeSpend / nextThreshold) * 100))
      : 100;
    const spendToNext = nextTier ? Math.max(0, nextThreshold - user.lifetimeSpend) : 0;

    // Referral stats
    const referralStats = {
      total: referrals.length,
      pending: referrals.filter(r => r.status === 'PENDING').length,
      qualified: referrals.filter(r => r.status === 'QUALIFIED').length,
      rewarded: referrals.filter(r => r.status === 'REWARDED').length,
      pointsEarned: referrals.filter(r => r.status === 'REWARDED').length * settings.referralRewardPoints,
    };

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
      ledger: ledger.map(e => ({
        id: e.id,
        type: e.type,
        points: e.points,
        reason: e.reason,
        createdAt: e.createdAt,
        expiresAt: e.expiresAt,
      })),
      referrals: {
        ...referralStats,
        list: referrals.map(r => ({
          id: r.id,
          status: r.status,
          refereeName: r.referee?.name || r.refereeEmail || 'Pending sign-up',
          createdAt: r.createdAt,
          rewardedAt: r.rewardedAt,
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
  } catch (e: any) {
    console.error('[loyalty/me]', e?.message, e?.code, e?.stack?.split('\n').slice(0, 5).join(' | '));
    // ANY error here — return a safe fallback so the customer always sees the dashboard.
    // (Better to show empty Founder's Circle than "Could not load your loyalty".)
    return NextResponse.json({
      user: {
        tier: 'FOUND',
        tierLabel: 'Found',
        tierBlurb: "You've started a trunk with us.",
        points: 0,
        lifetimePoints: 0,
        lifetimeSpend: 0,
        referralCode: null,
        name: null,
        email: null,
      },
      progress: {
        nextTier: 'KNOWN',
        nextTierLabel: 'Known',
        nextThreshold: 2500000,
        spendToNext: 2500000,
        progressPct: 0,
      },
      ledger: [],
      referrals: { total: 0, pending: 0, qualified: 0, rewarded: 0, pointsEarned: 0, list: [] },
      settings: {
        paisePerPoint: 10000,
        redemptionValue: 100,
        minRedemption: 100,
        maxRedemptionPct: 50,
        referralRewardPoints: 500,
        refereeDiscountPct: 10,
      },
      warning: process.env.NODE_ENV === 'development' ? e?.message : undefined,
      degraded: true,
    });
  }
}
