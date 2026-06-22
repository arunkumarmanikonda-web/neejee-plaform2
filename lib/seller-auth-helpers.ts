// Seller portal authorization helpers.
// Mirrors lib/vendor-auth-helpers.ts but for the seller side.
//
// Returns the SELLER row that the current user can operate on (either as owner
// or as a TEAM member with the given access level).

import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/auth';

export type SellerContext = {
  seller: { id: string; businessName: string; userId: string | null; kycStatus: string };
  isOwner: boolean;
  isStaff: boolean;
  accessLevel: 'FULL' | 'INVENTORY_ONLY' | 'FINANCE_ONLY' | null;
  actorRole: 'SELLER' | 'SELLER_STAFF' | 'ADMIN' | 'SUPER_ADMIN';
};

/** Returns the SellerContext for the current user, or null if not authorized. */
export async function getSellerContext(user: SessionUser | null): Promise<SellerContext | null> {
  if (!user) return null;

  // Admins can view any seller — but require ?sellerId= or business logic to pass id.
  // For the seller portal, admins are NOT treated as a seller; they go via /admin/sellers.
  if (user.role === 'SELLER') {
    const seller = await prisma.seller.findFirst({
      where: { userId: user.id },
      select: { id: true, businessName: true, userId: true, kycStatus: true },
    });
    if (!seller) return null;
    return {
      seller,
      isOwner: true,
      isStaff: false,
      accessLevel: 'FULL',
      actorRole: 'SELLER',
    };
  }

  if (user.role === 'SELLER_STAFF') {
    const tm = await prisma.sellerTeamMember.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: {
        seller: { select: { id: true, businessName: true, userId: true, kycStatus: true } },
      },
    });
    if (!tm) return null;
    return {
      seller: tm.seller,
      isOwner: false,
      isStaff: true,
      accessLevel: tm.accessLevel as any,
      actorRole: 'SELLER_STAFF',
    };
  }

  return null;
}

/** Hard-require a seller context (throws 401-style result if missing). */
export async function requireSellerContext(user: SessionUser | null): Promise<
  { ok: true; ctx: SellerContext } | { ok: false; status: number; error: string }
> {
  const ctx = await getSellerContext(user);
  if (!ctx) return { ok: false, status: 401, error: 'No seller context for this user' };
  return { ok: true, ctx };
}

/** Check whether the current actor can edit inventory fields. */
export function canEditInventory(ctx: SellerContext): boolean {
  if (ctx.isOwner) return true;
  return ctx.accessLevel === 'FULL' || ctx.accessLevel === 'INVENTORY_ONLY';
}

/** Check whether the current actor can edit bank / sensitive finance. */
export function canEditFinance(ctx: SellerContext): boolean {
  if (ctx.isOwner) return true;
  return ctx.accessLevel === 'FULL' || ctx.accessLevel === 'FINANCE_ONLY';
}

/** Owner-only actions (team invites, account settings). */
export function canManageAccount(ctx: SellerContext): boolean {
  return ctx.isOwner;
}
