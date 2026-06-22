// Marketing maker-checker RBAC.
//
//   MARKETING_OPERATOR  → can DRAFT/EDIT, can SUBMIT for approval
//                          cannot SEND, cannot APPROVE
//   MARKETING_MANAGER   → all of the above + APPROVE / SEND
//   ADMIN / SUPER_ADMIN → all powers, including bypass (direct send)

import type { SessionUser } from '@/lib/auth';

export type MarketingPermission =
  | 'marketing.read'
  | 'marketing.draft'         // create / edit drafts
  | 'marketing.submit'        // submit for approval
  | 'marketing.approve'       // approve a pending request
  | 'marketing.send'          // actually fire the campaign / broadcast
  | 'marketing.bypass';       // skip the maker-checker queue entirely

const PERMS: Record<string, MarketingPermission[]> = {
  SUPER_ADMIN:        ['marketing.read', 'marketing.draft', 'marketing.submit', 'marketing.approve', 'marketing.send', 'marketing.bypass'],
  ADMIN:              ['marketing.read', 'marketing.draft', 'marketing.submit', 'marketing.approve', 'marketing.send', 'marketing.bypass'],
  MARKETING_MANAGER:  ['marketing.read', 'marketing.draft', 'marketing.submit', 'marketing.approve', 'marketing.send'],
  MARKETING_OPERATOR: ['marketing.read', 'marketing.draft', 'marketing.submit'],
};

export function hasMarketingPerm(user: SessionUser | null, perm: MarketingPermission): boolean {
  if (!user) return false;
  return (PERMS[user.role] || []).includes(perm);
}

export function requireMarketingPerm(user: SessionUser | null, perm: MarketingPermission):
  { ok: true } | { ok: false; status: number; error: string } {
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!hasMarketingPerm(user, perm)) {
    return { ok: false, status: 403, error: `Forbidden: requires ${perm}` };
  }
  return { ok: true };
}

// Convenience checks for UI gating
export const canReadMarketing    = (u: SessionUser | null) => hasMarketingPerm(u, 'marketing.read');
export const canDraftMarketing   = (u: SessionUser | null) => hasMarketingPerm(u, 'marketing.draft');
export const canApproveMarketing = (u: SessionUser | null) => hasMarketingPerm(u, 'marketing.approve');
export const canSendMarketing    = (u: SessionUser | null) => hasMarketingPerm(u, 'marketing.send');
export const canBypassMarketing  = (u: SessionUser | null) => hasMarketingPerm(u, 'marketing.bypass');
