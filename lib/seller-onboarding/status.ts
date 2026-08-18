import { prisma } from '@/lib/prisma';

export type SellerActivationSnapshot = {
  hasPan: boolean;
  hasBank: boolean;
  hasGstin: boolean;
  hasPortfolio: boolean;
  hasUserAccount: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  autoKycPassed: boolean;
  readyForReview: boolean;
  canApprove: boolean;
  blockers: string[];
  warnings: string[];
};

export async function getSellerActivationSnapshot(sellerId: string): Promise<SellerActivationSnapshot | null> {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      pan: true,
      gstin: true,
      bankAccount: true,
      ifsc: true,
      bankName: true,
      portfolio: true,
      userId: true,
      autoKycPassed: true,
      user: {
        select: {
          emailVerified: true,
          phoneVerified: true,
        },
      },
    },
  });

  if (!seller) return null;

  const hasPan = !!String(seller.pan || '').trim();
  const hasBank =
    !!String(seller.bankAccount || '').trim() &&
    !!String(seller.ifsc || '').trim() &&
    !!String(seller.bankName || '').trim();
  const hasGstin = !!String(seller.gstin || '').trim();
  const hasPortfolio = Array.isArray((seller as any).portfolio) && (seller as any).portfolio.length > 0;
  const hasUserAccount = !!seller.userId;
  const phoneVerified = !!seller.user?.phoneVerified;
  const emailVerified = !!seller.user?.emailVerified;
  const autoKycPassed = !!seller.autoKycPassed;

  const blockers: string[] = [];
  const warnings: string[] = [];

  // Block approval only when mandatory identity/access prerequisites are missing.
  // An automated KYC exception is deliberately NOT an approval blocker: it is a
  // reason for human review, which an admin can resolve before approving.
  if (!hasPan) blockers.push('PAN missing');
  if (!hasBank) blockers.push('Bank details incomplete');
  if (!hasUserAccount) blockers.push('Linked user account missing');
  if (!phoneVerified) blockers.push('Phone OTP not verified');
  if (!emailVerified) blockers.push('Email OTP not verified');

  if (!autoKycPassed) warnings.push('Automated KYC requires manual review');
  if (!hasGstin) warnings.push('GSTIN missing');
  if (!hasPortfolio) warnings.push('Portfolio missing');

  const readyForReview =
    hasPan &&
    hasBank &&
    hasUserAccount &&
    phoneVerified &&
    emailVerified;
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

export async function syncSellerKycStatus(sellerId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: {
      id: true,
      kycStatus: true,
    },
  });

  if (!seller) return null;

  const adminFinalStates = new Set(['APPROVED', 'REJECTED', 'SUSPENDED']);
  if (adminFinalStates.has(String(seller.kycStatus))) {
    return seller;
  }

  const snapshot = await getSellerActivationSnapshot(sellerId);
  if (!snapshot) return seller;

  return prisma.seller.update({
    where: { id: sellerId },
    data: {
      kycStatus: snapshot.readyForReview ? 'UNDER_REVIEW' : 'PENDING',
    },
    // Never ask Prisma to return the full Seller scalar set here. This helper is
    // called from onboarding, email verification and review transitions, so a
    // future schema drift must not make a status update fail for an unrelated field.
    select: {
      id: true,
      kycStatus: true,
    },
  });
}
