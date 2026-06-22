// Admin loyalty dashboard data + settings
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { getSettings } from '@/lib/loyalty';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const [
      tierBreakdown,
      totalPointsIssued,
      totalPointsRedeemed,
      activeMembers,
      referralStats,
      recentTierUps,
      settings,
    ] = await Promise.all([
      prisma.user.groupBy({
        by: ['loyaltyTier'],
        where: { role: 'CUSTOMER' },
        _count: { _all: true },
        _sum: { lifetimeSpend: true, loyaltyPoints: true },
      }),
      prisma.loyaltyLedger.aggregate({
        where: { points: { gt: 0 }, type: { in: ['EARN', 'REFERRAL', 'WELCOME', 'TIER_BONUS'] } },
        _sum: { points: true },
      }),
      prisma.loyaltyLedger.aggregate({
        where: { type: 'REDEEM' },
        _sum: { points: true },
      }),
      prisma.user.count({
        where: { role: 'CUSTOMER', loyaltyPoints: { gt: 0 } },
      }),
      prisma.referral.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.loyaltyLedger.findMany({
        where: { type: 'EARN' },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
          user: { select: { name: true, email: true, loyaltyTier: true } },
        },
      }),
      getSettings(),
    ]);

    return NextResponse.json({
      tiers: tierBreakdown,
      kpis: {
        pointsIssued: totalPointsIssued._sum.points || 0,
        pointsRedeemed: Math.abs(totalPointsRedeemed._sum.points || 0),
        pointsOutstanding: (totalPointsIssued._sum.points || 0) + (totalPointsRedeemed._sum.points || 0),
        activeMembers,
        redemptionRate: totalPointsIssued._sum.points
          ? Math.round((Math.abs(totalPointsRedeemed._sum.points || 0) / totalPointsIssued._sum.points) * 100)
          : 0,
      },
      referrals: referralStats,
      recentActivity: recentTierUps.map(e => ({
        id: e.id,
        type: e.type,
        points: e.points,
        reason: e.reason,
        userName: e.user?.name || e.user?.email,
        tier: e.user?.loyaltyTier,
        createdAt: e.createdAt,
      })),
      settings,
    });
  } catch (e: any) {
    console.error('[admin/loyalty] GET error:', e);
    const isMissingTable = /relation|does not exist|column .* does not exist|loyaltyTier/i.test(e?.message || '');
    if (isMissingTable) {
      return NextResponse.json({
        tiers: [],
        kpis: { pointsIssued: 0, pointsRedeemed: 0, pointsOutstanding: 0, activeMembers: 0, redemptionRate: 0 },
        referrals: [],
        recentActivity: [],
        settings: { paisePerPoint: 10000, multiplierFound: 1.0, multiplierKnown: 1.5, multiplierPersonal: 2.0, multiplierFamily: 3.0, redemptionValue: 100, minRedemption: 100, maxRedemptionPct: 50, thresholdKnown: 2500000, thresholdPersonal: 7500000, thresholdFamily: 20000000, referralRewardPoints: 500, refereeDiscountPct: 10, refereeMinOrder: 250000, pointsExpireMonths: 12, familyNeverExpire: true },
        needsMigration: true,
      });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const allowed = [
      'paisePerPoint', 'multiplierFound', 'multiplierKnown', 'multiplierPersonal', 'multiplierFamily',
      'redemptionValue', 'minRedemption', 'maxRedemptionPct',
      'thresholdKnown', 'thresholdPersonal', 'thresholdFamily',
      'referralRewardPoints', 'refereeDiscountPct', 'refereeMinOrder',
      'pointsExpireMonths', 'familyNeverExpire',
    ];
    const data: any = {};
    for (const k of allowed) if (k in body) data[k] = body[k];

    const settings = await prisma.loyaltySettings.upsert({
      where: { id: 'singleton' },
      update: data,
      create: { id: 'singleton', ...data },
    });
    return NextResponse.json({ settings });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
