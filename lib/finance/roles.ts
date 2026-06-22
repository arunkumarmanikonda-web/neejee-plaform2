// Centralized RBAC for the Finance module.
// All finance routes must guard with one of these helpers.

import type { SessionUser } from '@/lib/auth';

export type FinancePermission =
  | 'finance.read'        // view P&L, expenses, returns, dashboards
  | 'finance.write'       // create/edit drafts (maker)
  | 'finance.approve'     // approve PENDING entries (checker)
  | 'finance.delete'      // hard-delete (super admin only)
  | 'finance.admin';      // edit categories, thresholds, cron settings

/** Which roles get which finance permissions. */
const PERMS: Record<string, FinancePermission[]> = {
  SUPER_ADMIN:        ['finance.read', 'finance.write', 'finance.approve', 'finance.delete', 'finance.admin'],
  ADMIN:              ['finance.read', 'finance.write', 'finance.approve', 'finance.admin'],
  FINANCE:            ['finance.read', 'finance.write', 'finance.approve', 'finance.admin'],
  FINANCE_OPERATOR:   ['finance.read', 'finance.write'],   // maker only
};

export function hasFinancePerm(user: SessionUser | null, perm: FinancePermission): boolean {
  if (!user) return false;
  const role = user.role;
  return (PERMS[role] || []).includes(perm);
}

export function requireFinancePerm(user: SessionUser | null, perm: FinancePermission): { ok: true } | { ok: false; status: number; error: string } {
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!hasFinancePerm(user, perm)) {
    return { ok: false, status: 403, error: `Forbidden: requires ${perm}` };
  }
  return { ok: true };
}

/** Quick checks for UI rendering. */
export const canReadFinance     = (u: SessionUser | null) => hasFinancePerm(u, 'finance.read');
export const canWriteFinance    = (u: SessionUser | null) => hasFinancePerm(u, 'finance.write');
export const canApproveFinance  = (u: SessionUser | null) => hasFinancePerm(u, 'finance.approve');
export const canDeleteFinance   = (u: SessionUser | null) => hasFinancePerm(u, 'finance.delete');
export const canAdminFinance    = (u: SessionUser | null) => hasFinancePerm(u, 'finance.admin');
