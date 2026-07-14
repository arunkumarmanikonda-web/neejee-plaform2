import { prisma } from '@/lib/prisma';

export async function syncSellerKycStatus(sellerId: string) {
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

  const adminFinalStates = new Set(['APPROVED', 'REJECTED', 'SUSPENDED']);
  if (adminFinalStates.has(String(seller.kycStatus))) {
    return seller;
  }

  const readyForReview =
    !!seller.autoKycPassed &&
    !!seller.user?.phoneVerified &&
    !!seller.user?.emailVerified;

  return prisma.seller.update({
    where: { id: sellerId },
    data: {
      kycStatus: readyForReview ? 'UNDER_REVIEW' : 'PENDING',
    },
  });
}