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
    include: {
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

export async function syncSellerKycStatus(sellerId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
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
  });
}