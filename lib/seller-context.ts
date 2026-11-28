import { prisma } from './prisma';
import { getSession } from './auth';
import { canEditFinance, canEditInventory, getSellerContext } from './seller-auth-helpers';

export async function requireApprovedSeller(work: 'inventory' | 'finance') {
  const user = await getSession();
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' };
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const ctx = await getSellerContext(user);
  if (!ctx && !isAdmin) return { ok: false as const, status: 403, error: 'No active seller account' };
  if (ctx && (ctx.seller.kycStatus !== 'APPROVED' || !(work === 'finance' ? canEditFinance(ctx) : canEditInventory(ctx)))) {
    return { ok: false as const, status: 403, error: 'Access denied for this seller account' };
  }
  const seller = await prisma.seller.findFirst({ where: ctx ? { id: ctx.seller.id } : { userId: user.id } });
  return { ok: true as const, user, seller, isAdmin };
}
