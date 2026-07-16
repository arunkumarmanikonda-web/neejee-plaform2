import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { getSellerActivationSnapshot } from '@/lib/seller-onboarding/status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canAccess(user: Awaited<ReturnType<typeof getSession>>) {
  return requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM', 'CONTENT_EDITOR']);
}

export async function GET() {
  const user = await getSession();

  if (!canAccess(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [
      sellerCountsRaw,
      inventoryCountsRaw,
      pendingChangeRequestCount,
      sellerRowsRaw,
      pendingChangeRequests,
      inventoryQueue,
    ] = await Promise.all([
      prisma.seller.groupBy({
        by: ['kycStatus'],
        _count: { _all: true },
      }),
      prisma.sellerInventorySubmission.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.sellerChangeRequest.count({
        where: { status: 'PENDING' },
      }),
      prisma.seller.findMany({
        where: {
          kycStatus: {
            in: ['PENDING', 'UNDER_REVIEW', 'REJECTED', 'APPROVED'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          user: {
            select: {
              emailVerified: true,
              phoneVerified: true,
            },
          },
          products: { select: { id: true } },
        },
      }),
      prisma.sellerChangeRequest.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          seller: {
            select: {
              id: true,
              businessName: true,
              slug: true,
            },
          },
          _count: {
            select: {
              supportingDocs: true,
            },
          },
        },
      }),
      prisma.sellerInventorySubmission.findMany({
        where: {
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO'],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          seller: {
            select: {
              id: true,
              businessName: true,
              slug: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const sellerCounts = sellerCountsRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.kycStatus] = row._count._all;
      return acc;
    }, {});

    const inventoryCounts = inventoryCountsRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});

    const pendingSellers = await Promise.all(
      sellerRowsRaw.map(async (seller: any) => {
        const activation = await getSellerActivationSnapshot(seller.id);

        return {
          id: seller.id,
          slug: seller.slug,
          businessName: seller.businessName,
          contactName: seller.contactName,
          email: seller.email,
          phone: seller.phone,
          craft: seller.craft,
          region: seller.region,
          kycStatus: seller.kycStatus,
          createdAt: seller.createdAt.toISOString(),
          productCount: seller.products.length,
          hasPan: !!activation?.hasPan,
          hasGstin: !!activation?.hasGstin,
          hasBank: !!activation?.hasBank,
          hasPortfolio: !!activation?.hasPortfolio,
          hasUserAccount: !!activation?.hasUserAccount,
          phoneVerified: !!activation?.phoneVerified,
          emailVerified: !!activation?.emailVerified,
          autoKycPassed: !!activation?.autoKycPassed,
          canActivate: !!activation?.canApprove && seller.kycStatus === 'UNDER_REVIEW',
          blockers: activation?.blockers || [],
          warnings: activation?.warnings || [],
        };
      })
    );

    return NextResponse.json({
      summary: {
        sellersPending: sellerCounts.PENDING || 0,
        sellersUnderReview: sellerCounts.UNDER_REVIEW || 0,
        sellersApproved: sellerCounts.APPROVED || 0,
        sellersRejected: sellerCounts.REJECTED || 0,
        changeRequestsPending: pendingChangeRequestCount,
        inventorySubmitted: inventoryCounts.SUBMITTED || 0,
        inventoryUnderReview: inventoryCounts.UNDER_REVIEW || 0,
        inventoryNeedsInfo: inventoryCounts.NEEDS_INFO || 0,
        activationReady: pendingSellers.filter((row: any) => row.canActivate).length,
      },
      pendingSellers,
      pendingChangeRequests: pendingChangeRequests.map((row: any) => ({
        id: row.id,
        sellerId: row.sellerId,
        seller: row.seller,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        changedFieldCount: Object.keys((row.fieldChanges as any) || {}).length,
        supportingDocCount: row._count?.supportingDocs || 0,
        reason: row.reason || null,
      })),
      inventoryQueue: inventoryQueue.map((row: any) => ({
        id: row.id,
        sellerId: row.sellerId,
        seller: row.seller,
        product: row.product,
        status: row.status,
        submissionType: row.submissionType,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load seller onboarding overview' },
      { status: 500 }
    );
  }
}