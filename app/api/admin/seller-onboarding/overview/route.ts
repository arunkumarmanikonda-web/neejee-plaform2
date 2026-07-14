import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

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
      pendingSellers,
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
        select: {
          id: true,
          slug: true,
          businessName: true,
          contactName: true,
          email: true,
          phone: true,
          craft: true,
          region: true,
          kycStatus: true,
          createdAt: true,
          pan: true,
          gstin: true,
          bankAccount: true,
          ifsc: true,
          bankName: true,
          portfolio: true,
          userId: true,
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

    const sellerRows = pendingSellers.map((seller) => {
      const hasPan = !!seller.pan;
      const hasGstin = !!seller.gstin;
      const hasBank = !!seller.bankAccount && !!seller.ifsc && !!seller.bankName;
      const hasPortfolio = Array.isArray(seller.portfolio) && seller.portfolio.length > 0;
      const canActivate = seller.kycStatus === 'APPROVED' && hasPan && hasBank;

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
        hasPan,
        hasGstin,
        hasBank,
        hasPortfolio,
        hasUserAccount: !!seller.userId,
        canActivate,
      };
    });

    const activationReadyCount = sellerRows.filter((row) => row.canActivate).length;

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
        activationReady: activationReadyCount,
      },
      pendingSellers: sellerRows,
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