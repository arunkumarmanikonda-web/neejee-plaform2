// Customer loyalty summary. Never fabricates zero balances if the real loyalty
// query fails: the account UI handles a temporary 5xx state and retries.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCurrentBalance, getSettings, ensureReferralCode, getTierProgress } from '@/lib/loyalty';

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
          loyaltyPoints: true,
          lifetimePoints: true,
          lifetimeSpend: true,
          referralCode: true,
        },
      }),
      getSettings(),
    ]);
    if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    const referralCode = user.referralCode || await ensureReferralCode(user.id);
    const [balance, ledger, referrals, referralCounts] = await Promise.all([
      getCurrentBalance(user.id),
      prisma.loyaltyLedger.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, type: true, points: true, reason: true, orderId: true, expiresAt: true, createdAt: true },
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
          referee: { select: { name: true } },
        },
      }),
      prisma.referral.groupBy({
        where: { referrerId: user.id },
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const progress = getTierProgress(user.lifetimeSpend, settings);
    const totalReferrals = referralCounts.reduce((sum, row) => sum + row._count._all, 0);
    const rewardedReferrals = referralCounts
      .filter((row) => row.status === 'REWARDED')
      .reduce((sum, row) => sum + row._count._all, 0);

    return NextResponse.json({
      user: {
        name: user.name,
        email: user.email,
        tier: user.loyaltyTier,
        points: balance,
        lifetimePoints: user.lifetimePoints,
        lifetimeSpend: user.lifetimeSpend,
        referralCode,
      },
      progress,
      ledger,
      referrals: referrals.map((referral) => ({
        id: referral.id,
        status: referral.status,
        pointsAwarded: referral.pointsAwarded,
        createdAt: referral.createdAt,
        refereeName: publicReferralName(referral.referee?.name),
      })),
      stats: { totalReferrals, rewardedReferrals },
      settings: {
        redemptionValue: settings.redemptionValue,
        minRedemption: settings.minRedemption,
        maxRedemptionPct: settings.maxRedemptionPct,
        referralRewardPoints: settings.referralRewardPoints,
        refereeDiscountPct: settings.refereeDiscountPct,
        thresholds: {
          known: settings.thresholdKnown,
          personal: settings.thresholdPersonal,
          family: settings.thresholdFamily,
        },
      },
    });
  } catch (error: any) {
    console.error('[loyalty.me] failed', { userId: session.id, message: error?.message });
    return NextResponse.json({ error: "Founder's Circle is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
