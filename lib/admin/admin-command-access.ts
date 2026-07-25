import type { SessionUser } from '@/lib/auth';
import type { AdminCommandItem } from '@/lib/admin/admin-command-catalog';
import { hasFinancePerm } from '@/lib/finance/roles';

const GROUP_ROLE_BOOSTS: Record<string, SessionUser['role'][]> = {
  Operations: ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM'],
  Growth: ['ADMIN', 'SUPER_ADMIN', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'],
  Catalog: ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'],
  Marketplace: ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM'],
  ERP: ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'FINANCE_OPERATOR'],
  Finance: ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'FINANCE_OPERATOR'],
  Content: ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'],
  Admin: ['ADMIN', 'SUPER_ADMIN'],
};

export function canAccessAdminCommand(
  item: AdminCommandItem,
  user: SessionUser | null,
) {
  if (!user) return false;
  if (item.financePerm && !hasFinancePerm(user, item.financePerm)) return false;
  return true;
}

export function getVisibleAdminCommandItems(
  items: AdminCommandItem[],
  user: SessionUser | null,
) {
  return items.filter((item) => canAccessAdminCommand(item, user));
}

export function getAdminCommandRoleBoost(
  item: AdminCommandItem,
  user: SessionUser | null,
) {
  if (!user) return 0;
  if (item.financePerm && hasFinancePerm(user, item.financePerm)) return 5;
  const preferred = GROUP_ROLE_BOOSTS[item.group] ?? [];
  return preferred.includes(user.role) ? 3 : 0;
}
