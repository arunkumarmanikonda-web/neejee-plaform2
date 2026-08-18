import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApplicationStatus(seller: any) {
  const summary = seller?.autoKycSummary && typeof seller.autoKycSummary === 'object'
    ? seller.autoKycSummary
    : {};
  const onboarding = summary?.onboarding && typeof summary.onboarding === 'object'
    ? summary.onboarding
    : {};

  const explicit = String(onboarding?.applicationReviewStatus || '').trim().toUpperCase();
  if (['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].includes(explicit)) {
    return explicit;
  }

  const submittedAt = String(onboarding?.applicationSubmittedAt || '').trim();
  if (submittedAt) {
    // A newly submitted application must remain visible to the review team even
    // when it is linked to a pre-existing APPROVED Seller record. Seller.kycStatus
    // is the operational seller state; applicationStatus is the review-queue state.
    if (seller?.user?.emailVerified) return 'UNDER_REVIEW';
    return 'PENDING';
  }

  return String(seller?.kycStatus || 'PENDING');
}

export async function GET() {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sellers = await prisma.seller.findMany({
      take: 100,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        businessName: true,
        contactName: true,
        email: true,
        phone: true,
        craft: true,
        region: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
        autoKycSummary: true,
        user: {
          select: {
            emailVerified: true,
            phoneVerified: true,
          },
        },
        products: {
          select: { id: true },
        },
      },
    });

    return NextResponse.json({
      sellers: sellers.map((s: any) => {
        const summary = s?.autoKycSummary && typeof s.autoKycSummary === 'object' ? s.autoKycSummary : {};
        const onboarding = summary?.onboarding && typeof summary.onboarding === 'object' ? summary.onboarding : {};
        const applicationSubmittedAt = String(onboarding?.applicationSubmittedAt || '').trim() || null;

        return {
          id: s.id,
          businessName: s.businessName,
          contactName: s.contactName,
          email: s.email,
          phone: s.phone,
          craft: s.craft,
          region: s.region,
          kycStatus: s.kycStatus,
          applicationStatus: getApplicationStatus(s),
          applicationSubmittedAt,
          qualityScore: 0,
          commissionPct: 20,
          isNeejeeSelect: false,
          createdAt: s.createdAt?.toISOString?.() || new Date().toISOString(),
          updatedAt: s.updatedAt?.toISOString?.() || new Date().toISOString(),
          productCount: Array.isArray(s.products) ? s.products.length : 0,
        };
      }),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load sellers', sellers: [] },
      { status: 500 }
    );
  }
}
