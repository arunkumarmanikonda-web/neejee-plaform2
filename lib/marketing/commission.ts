// Effective commission resolver.
// Priority order: product override > category override > seller default.
// All values are PERCENT (0–100).
import { prisma } from '@/lib/prisma';

export async function resolveCommissionPct(
  sellerId: string,
  productId: string,
  categoryId: string,
): Promise<{ pct: number; source: 'product' | 'category' | 'seller' }> {
  // 1) Product-specific override
  const prod = await prisma.sellerProductCommission.findUnique({
    where: { sellerId_productId: { sellerId, productId } },
    select: { commissionPercent: true },
  });
  if (prod) return { pct: prod.commissionPercent, source: 'product' };

  // 2) Category override
  const cat = await prisma.sellerCategoryCommission.findUnique({
    where: { sellerId_categoryId: { sellerId, categoryId } },
    select: { commissionPercent: true },
  });
  if (cat) return { pct: cat.commissionPercent, source: 'category' };

  // 3) Seller default
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { commissionPct: true },
  });
  return { pct: seller?.commissionPct || 20, source: 'seller' };
}
