// Helper to resolve a vendor for a signed-in session. Handles both the
// primary vendor user (role=VENDOR) and team members (role=VENDOR_STAFF).
import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/auth';

export async function resolveVendorForSession(session: SessionUser | null): Promise<{
  vendorId: string;
  isOwner: boolean;
  accessLevel: 'FULL' | 'FINANCE_ONLY' | 'OPERATIONS_ONLY';
} | null> {
  if (!session) return null;
  if (session.role === 'VENDOR') {
    const v = await prisma.vendor.findUnique({
      where: { userId: session.id },
      select: { id: true },
    });
    if (!v) return null;
    return { vendorId: v.id, isOwner: true, accessLevel: 'FULL' };
  }
  if (session.role === 'VENDOR_STAFF') {
    const tm = await prisma.vendorTeamMember.findUnique({
      where: { userId: session.id },
      select: { vendorId: true, accessLevel: true, status: true },
    });
    if (!tm || tm.status !== 'ACTIVE') return null;
    return { vendorId: tm.vendorId, isOwner: false, accessLevel: tm.accessLevel as any };
  }
  return null;
}

// Check if a session has access to a specific feature based on access level.
export function hasFeatureAccess(
  accessLevel: 'FULL' | 'FINANCE_ONLY' | 'OPERATIONS_ONLY',
  feature: 'PROFILE_EDIT' | 'BANK_EDIT' | 'PO_CONFIRM' | 'PO_DISPATCH' | 'INVOICE_UPLOAD' | 'PAYOUTS_VIEW' | 'TEAM_MANAGE',
): boolean {
  if (accessLevel === 'FULL') return true;
  if (accessLevel === 'FINANCE_ONLY') {
    return ['PAYOUTS_VIEW', 'INVOICE_UPLOAD', 'PROFILE_EDIT'].includes(feature);
  }
  if (accessLevel === 'OPERATIONS_ONLY') {
    return ['PO_CONFIRM', 'PO_DISPATCH', 'INVOICE_UPLOAD'].includes(feature);
  }
  return false;
}
