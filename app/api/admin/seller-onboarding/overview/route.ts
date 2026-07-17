import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canAccess(user: Awaited<ReturnType<typeof getSession>>) {
  return requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM', 'CONTENT_EDITOR']);
}

function buildActivationSnapshot(seller: any) {
  const hasPan = !!String(seller.pan || '').trim();
  const hasBank =
    !!String(seller.bankAccount || '').trim() &&
    !!String(seller.ifsc || '').trim() &&
    !!String(seller.bankName || '').trim();
  const hasGstin = !!String(seller.gstin || '').trim();
  const hasPortfolio =
    Array.isArray(seller.portfolio) && seller.portfolio.length > 0;
  const hasUserAccount = !!seller.userId;
  const phoneVerified = !!seller.user?.phoneVerified;
  const emailVerified = !!seller.user?.emailVerified;
  const autoKycPassed = !!seller.autoKycPassed;

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!hasPan) blockers.push('PAN missing');
  if (!hasBank) blockers.push('Bank details incomplete');
  if (!hasUserAccount) blockers.push('Linked user account missing');
  if (!phoneVerified) blockers.push('Phone OTP not verified');
  if (!emailVerified) blockers.push('Email OTP not verified');
  if (!autoKycPassed) blockers.push('Auto KYC not passed');

  if (!hasGstin) warnings.push('GSTIN missing');
  if (!hasPortfolio) warnings.push('Portfolio missing');

  const readyForReview = autoKycPassed && phoneVerified && emailVerified;
  const canApprove = blockers.length === 0;

  return {
    hasPan,
    hasBank,
    hasGstin,
    hasPortfolio,
    hasUserAccount,
    phoneVerified,
    emailVerified,
    autoKycPassed,
    readyForReview,
    canApprove,
    blockers,
    warnings,
  };
}

export async function GET() {
  const user = await getSession();

  if (!canAccess(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sellerCountsRaw = await prisma.seller.groupBy({
      by: ['kycStatus'],
      _count: { _all: true },
    });

    const inventoryCountsRaw = await prisma.sellerInventorySubmission.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const pendingChangeRequestCount = await prisma.sellerChangeRequest.count({
      where: { status: 'PENDING' },
    });

    const sellerRowsRaw = await prisma.seller.findMany({
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
    });

    const pendingChangeRequests = await prisma.sellerChangeRequest.findMany({
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
    });

    const inventoryQueue = await prisma.sellerInventorySubmission.findMany({
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
    });

    const sellerCounts = sellerCountsRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.kycStatus] = row._count._all;
      return acc;
    }, {});

    const inventoryCounts = inventoryCountsRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});

    const pendingSellers = sellerRowsRaw.map((seller: any) => {
      const activation = buildActivationSnapshot(seller);

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
        hasPan: activation.hasPan,
        hasGstin: activation.hasGstin,
        hasBank: activation.hasBank,
        hasPortfolio: activation.hasPortfolio,
        hasUserAccount: activation.hasUserAccount,
        phoneVerified: activation.phoneVerified,
        emailVerified: activation.emailVerified,
        autoKycPassed: activation.autoKycPassed,
        canActivate: activation.canApprove && seller.kycStatus === 'UNDER_REVIEW',
        blockers: activation.blockers,
        warnings: activation.warnings,
      };
    });

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