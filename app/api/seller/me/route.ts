// GET /api/seller/me — seller profile + stats + profile completion.
// Powers the new seller dashboard. Supports both SELLER (owner) and SELLER_STAFF.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { computeSellerCompletion, sellerChecklist } from '@/lib/seller-profile';
import { requireSellerContext, canEditFinance } from '@/lib/seller-auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { ctx } = gate;

  try {
    const seller = await prisma.seller.findUnique({
      where: { id: ctx.seller.id },
      include: {
        user: { select: { passwordHash: true } },
      },
    });
    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

    // Parallel aggregations — every block fail-safe
    const [
      productStats, docs, pendingChanges, paidPayouts, inventorySubmissions, orderValue, orderCount,
    ] = await Promise.all([
      prisma.product.groupBy({
        by: ['status'],
        where: { sellerId: ctx.seller.id },
        _count: { _all: true },
      }).catch(() => []),
      prisma.sellerDocument.findMany({
        where: { sellerId: ctx.seller.id },
        select: { docType: true, status: true },
      }).catch(() => []),
      prisma.sellerChangeRequest.count({
        where: { sellerId: ctx.seller.id, status: 'PENDING' },
      }).catch(() => 0),
      prisma.payout.findMany({
        where: { sellerId: ctx.seller.id, status: 'PAID' },
        select: { netPayoutPaise: true, paidAt: true },
      }).catch(() => []),
      prisma.sellerInventorySubmission.groupBy({
        by: ['status'],
        where: { sellerId: ctx.seller.id },
        _count: { _all: true },
      }).catch(() => []),
      prisma.orderItem.aggregate({ where: { product: { sellerId: ctx.seller.id } }, _sum: { total: true } }),
      prisma.order.count({ where: { items: { some: { product: { sellerId: ctx.seller.id } } } } }),
    ]);

    const approvedDocTypes = new Set<string>(
      docs.filter(d => d.status === 'APPROVED').map(d => String(d.docType))
    );
    const completion = computeSellerCompletion(seller as any, approvedDocTypes);
    const checklist = sellerChecklist(seller as any, approvedDocTypes);

    // Product buckets
    const productBuckets = {
      active: 0,
      draft: 0,
      pendingQc: 0,
      archived: 0,
    };
    for (const row of productStats) {
      const n = row._count._all;
      if (row.status === 'ACTIVE') productBuckets.active += n;
      else if (row.status === 'DRAFT') productBuckets.draft += n;
      else if (row.status === 'PENDING_QC') productBuckets.pendingQc += n;
      else productBuckets.archived += n;
    }

    // Inventory submission buckets
    const submissionBuckets = {
      pending: 0,
      underReview: 0,
      needsInfo: 0,
      published: 0,
    };
    for (const row of inventorySubmissions) {
      const n = row._count._all;
      if (row.status === 'SUBMITTED') submissionBuckets.pending += n;
      else if (row.status === 'UNDER_REVIEW') submissionBuckets.underReview += n;
      else if (row.status === 'NEEDS_INFO') submissionBuckets.needsInfo += n;
      else if (row.status === 'PUBLISHED') submissionBuckets.published += n;
    }

    const lifetimeRevenuePaise = orderValue._sum.total || 0;
    const lifetimeOrderCount = orderCount;

    // Payouts
    const lifetimePayoutPaise = paidPayouts.reduce((s, p) => s + (p.netPayoutPaise || 0), 0);

    return NextResponse.json({
      seller: {
        id: seller.id,
        businessName: seller.businessName,
        contactName: seller.contactName,
        email: seller.email,
        phone: seller.phone,
        slug: seller.slug,
        kycStatus: seller.kycStatus,
        story: seller.story,
        logoImage: seller.logoImage,
        coverImage: seller.coverImage,
        portfolio: seller.portfolio,
        pan: canEditFinance(ctx) ? seller.pan : null,
        gstin: canEditFinance(ctx) ? seller.gstin : null,
        bankAccount: canEditFinance(ctx) ? seller.bankAccount : null,
        ifsc: canEditFinance(ctx) ? seller.ifsc : null,
        bankName: canEditFinance(ctx) ? seller.bankName : null,
        region: seller.region,
        craft: seller.craft,
        cluster: seller.cluster,
        yearsOfPractice: seller.yearsOfPractice,
        commissionPct: seller.commissionPct,
        isNeejeeSelect: seller.isNeejeeSelect,
        qualityScore: seller.qualityScore,
        hasPassword: !!seller.user?.passwordHash,
      },
      ctx: {
        isOwner: ctx.isOwner,
        isStaff: ctx.isStaff,
        accessLevel: ctx.accessLevel,
      },
      stats: {
        completion,
        checklist,
        productBuckets,
        submissionBuckets,
        pendingChangeRequestsCount: pendingChanges,
        lifetimeRevenuePaise,
        lifetimeOrderCount,
        lifetimePayoutPaise: canEditFinance(ctx) ? lifetimePayoutPaise : null,
      },
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    console.error('[seller.me]', err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
