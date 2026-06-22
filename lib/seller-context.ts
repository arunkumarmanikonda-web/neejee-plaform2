// Helper: resolve the Seller record for the current logged-in user.
// Returns null if not a seller, throws if not authed.
import { prisma } from './prisma';
import { getSession } from './auth';

export async function getSellerContext() {
  const user = await getSession();
  if (!user) return { user: null, seller: null, isAdmin: false };

  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  // Admins may pass through with no seller record
  const seller = await prisma.seller.findFirst({
    where: { userId: user.id },
  }).catch(() => null);

  return { user, seller, isAdmin };
}

export async function requireApprovedSeller() {
  const { user, seller, isAdmin } = await getSellerContext();
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' };
  if (isAdmin) return { ok: true as const, user, seller, isAdmin: true };
  if (!seller) return { ok: false as const, status: 403, error: 'No seller account' };
  if (seller.kycStatus !== 'APPROVED') return { ok: false as const, status: 403, error: 'Seller account not approved yet' };
  return { ok: true as const, user, seller, isAdmin: false };
}
