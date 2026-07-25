import type { SessionUser } from '@/lib/auth';
import type { AdminCommandItem } from '@/lib/admin/admin-command-catalog';
import { hasFinancePerm } from '@/lib/finance/roles';

const GROUP_ROLE_PREFERENCE: Record<string, SessionUser['role'][]> = {
  Operations: ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM'],
  Growth: ['ADMIN', 'SUPER_ADMIN', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'],
  Catalog: ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'],
  Marketplace: ['ADMIN', 'SUPER_ADMIN', 'QC_TEAM'],
  ERP: ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'FINANCE_OPERATOR'],
  Finance: ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'FINANCE_OPERATOR'],
  Content: ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'],
  Admin: ['ADMIN', 'SUPER_ADMIN'],
};

export function canAccessAdminCommand(item: AdminCommandItem, user: SessionUser | null) {
  if (!user) return false;

  if (item.allowedRoles?.length && !item.allowedRoles.includes(user.role)) {
    return false;
  }

  if (item.financePerm && !hasFinancePerm(user, item.financePerm)) {
    return false;
  }

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

  if (item.allowedRoles?.includes(user.role)) {
    return 5;
  }

  const preferred = GROUP_ROLE_PREFERENCE[item.group] ?? [];
  if (preferred.includes(user.role)) {
    return 3;
  }

  if (item.financePerm && hasFinancePerm(user, item.financePerm)) {
    return 4;
  }

  return 0;
}