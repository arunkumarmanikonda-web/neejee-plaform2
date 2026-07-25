import type { SessionUser } from '@/lib/auth';
import type { AdminCommandItem } from '@/lib/admin/admin-command-catalog';

export type AdminRouteContext = {
  key: string;
  eyebrow: string;
  title: string;
  description: string;
  prefixes: string[];
  hrefs: string[];
};

export type AdminRoleFocus = {
  eyebrow: string;
  title: string;
  description: string;
};

const DASHBOARD_CONTEXT: AdminRouteContext = {
  key: 'dashboard',
  eyebrow: 'ADMIN HUB',
  title: 'Recommended from the admin hub',
  description: 'These actions keep high-traffic admin workflows one click away while the dashboard stays lightweight.',
  prefixes: ['/admin'],
  hrefs: [
    '/admin/products',
    '/admin/sellers',
    '/admin/orders',
    '/admin/finance/pnl',
    '/admin/erp/dashboard',
    '/admin/settings',
  ],
};

const ROUTE_CONTEXTS: AdminRouteContext[] = [
  {
    key: 'orders',
    eyebrow: 'OPERATIONS',
    title: 'Order workflow next steps',
    description: 'Move quickly between release, dispute, customer, and reconciliation flows tied to order operations.',
    prefixes: ['/admin/orders', '/admin/disputes', '/admin/customers'],
    hrefs: [
      '/admin/orders',
      '/admin/disputes',
      '/admin/customers',
      '/admin/finance/sales-invoices',
      '/admin/finance/revenue-ledger',
      '/admin/notifications',
    ],
  },
  {
    key: 'catalog',
    eyebrow: 'CATALOG',
    title: 'Catalog workflow next steps',
    description: 'Stay inside product, inventory, category, and merchandising loops without going back to broad navigation.',
    prefixes: ['/admin/products', '/admin/categories', '/admin/inventory', '/admin/merchandising', '/admin/catalogues'],
    hrefs: [
      '/admin/products',
      '/admin/products/new',
      '/admin/categories',
      '/admin/inventory',
      '/admin/merchandising',
      '/admin/crafts',
    ],
  },
  {
    key: 'seller',
    eyebrow: 'MARKETPLACE',
    title: 'Seller and vendor workflow next steps',
    description: 'Continue onboarding, agreement, payout, change-request, and catalogue review work from the current marketplace area.',
    prefixes: ['/admin/sellers', '/admin/vendors', '/admin/seller-onboarding', '/admin/seller-change-requests', '/admin/vendor-change-requests'],
    hrefs: [
      '/admin/sellers',
      '/admin/seller-onboarding',
      '/admin/seller-change-requests',
      '/admin/vendors',
      '/admin/vendor-change-requests',
      '/admin/finance/seller-payouts',
    ],
  },
  {
    key: 'finance',
    eyebrow: 'FINANCE',
    title: 'Finance workflow next steps',
    description: 'Keep adjacent finance surfaces close: reporting, ledgers, payouts, bills, and reconciliation.',
    prefixes: ['/admin/finance'],
    hrefs: [
      '/admin/finance/pnl',
      '/admin/finance/trial-balance',
      '/admin/finance/ledger',
      '/admin/finance/expenses',
      '/admin/finance/seller-payouts',
      '/admin/finance/bank-reconciliation',
    ],
  },
  {
    key: 'erp',
    eyebrow: 'ERP',
    title: 'ERP workflow next steps',
    description: 'Jump between dashboard, failures, and reconciliation surfaces while working operational incidents.',
    prefixes: ['/admin/erp'],
    hrefs: [
      '/admin/erp/dashboard',
      '/admin/erp/failures',
      '/admin/erp/reconciliation',
      '/admin/orders',
      '/admin/finance/bank-reconciliation',
      '/admin/notifications',
    ],
  },
  {
    key: 'content',
    eyebrow: 'CONTENT',
    title: 'Content and campaign workflow next steps',
    description: 'Move across CMS, assets, marketing studio, approvals, and journal surfaces from the same editorial context.',
    prefixes: ['/admin/cms', '/admin/assets', '/admin/marketing', '/admin/marketing-studio', '/admin/marketing-approvals', '/admin/journal', '/admin/editorial-blocks'],
    hrefs: [
      '/admin/cms',
      '/admin/assets',
      '/admin/marketing-studio',
      '/admin/marketing-approvals',
      '/admin/editorial-blocks',
      '/admin/journal',
    ],
  },
  {
    key: 'admin',
    eyebrow: 'CONTROL',
    title: 'Admin control next steps',
    description: 'Stay close to team, settings, compliance, and recovery controls when operating the platform.',
    prefixes: ['/admin/settings', '/admin/team', '/admin/compliance', '/admin/recovery-settings'],
    hrefs: [
      '/admin/team',
      '/admin/settings',
      '/admin/compliance/einvoice',
      '/admin/compliance/tds',
      '/admin/recovery-settings',
      '/admin/profile',
    ],
  },
];

const DEFAULT_ROLE_HREFS = [
  '/admin/products',
  '/admin/orders',
  '/admin/sellers',
  '/admin/finance/pnl',
  '/admin/erp/dashboard',
  '/admin/settings',
];

const ROLE_PRIORITY_HREFS: Record<string, string[]> = {
  SUPER_ADMIN: [
    '/admin/team',
    '/admin/settings',
    '/admin/sellers',
    '/admin/products',
    '/admin/finance/pnl',
    '/admin/erp/dashboard',
  ],
  ADMIN: [
    '/admin/products',
    '/admin/orders',
    '/admin/sellers',
    '/admin/finance/pnl',
    '/admin/erp/dashboard',
    '/admin/settings',
  ],
  FINANCE: [
    '/admin/finance/pnl',
    '/admin/finance/trial-balance',
    '/admin/finance/ledger',
    '/admin/finance/expenses',
    '/admin/finance/seller-payouts',
    '/admin/finance/bank-reconciliation',
  ],
  FINANCE_OPERATOR: [
    '/admin/finance/expenses',
    '/admin/finance/ledger',
    '/admin/finance/sales-invoices',
    '/admin/finance/seller-payouts',
    '/admin/finance/vendor-payouts',
    '/admin/finance/bank-reconciliation',
  ],
  MARKETING_MANAGER: [
    '/admin/marketing-studio',
    '/admin/marketing-approvals',
    '/admin/cms',
    '/admin/assets',
    '/admin/editorial-blocks',
    '/admin/journal',
  ],
  MARKETING_OPERATOR: [
    '/admin/marketing-studio',
    '/admin/assets',
    '/admin/cms',
    '/admin/marketing-approvals',
    '/admin/journal',
    '/admin/notifications',
  ],
  CONTENT_EDITOR: [
    '/admin/cms',
    '/admin/editorial-blocks',
    '/admin/assets',
    '/admin/journal',
    '/admin/marketing-studio',
    '/admin/marketing-approvals',
  ],
  QC_TEAM: [
    '/admin/reviews',
    '/admin/disputes',
    '/admin/seller-change-requests',
    '/admin/vendor-change-requests',
    '/admin/products',
    '/admin/orders',
  ],
};

function byHref(items: AdminCommandItem[]) {
  return new Map(items.map((item) => [item.href, item]));
}

function pickByHrefs(items: AdminCommandItem[], hrefs: string[], limit = 6): AdminCommandItem[] {
  const map = byHref(items);
  const picked: AdminCommandItem[] = [];

  for (const href of hrefs) {
    const item = map.get(href);
    if (!item) continue;
    picked.push(item);
    if (picked.length >= limit) break;
  }

  return picked;
}

export function dedupeAdminItems(items: AdminCommandItem[], limit = 6): AdminCommandItem[] {
  const seen = new Set<string>();
  const deduped: AdminCommandItem[] = [];

  for (const item of items) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

export function getAdminRouteContext(pathname: string | null | undefined): AdminRouteContext {
  const current = pathname || '/admin';

  const matches = ROUTE_CONTEXTS
    .filter((context) =>
      context.prefixes.some((prefix) => current === prefix || current.startsWith(`${prefix}/`)),
    )
    .sort((a, b) => {
      const aLen = Math.max(...a.prefixes.map((prefix) => prefix.length));
      const bLen = Math.max(...b.prefixes.map((prefix) => prefix.length));
      return bLen - aLen;
    });

  return matches[0] ?? DASHBOARD_CONTEXT;
}

export function getContextualAdminItems(
  items: AdminCommandItem[],
  pathname: string | null | undefined,
  limit = 6,
): AdminCommandItem[] {
  const context = getAdminRouteContext(pathname);
  return pickByHrefs(items, context.hrefs, limit);
}

export function getRolePriorityAdminItems(
  items: AdminCommandItem[],
  user: SessionUser | null | undefined,
  limit = 6,
): AdminCommandItem[] {
  const role = user?.role ?? 'ADMIN';
  const hrefs = ROLE_PRIORITY_HREFS[role] ?? DEFAULT_ROLE_HREFS;
  return pickByHrefs(items, hrefs, limit);
}

export function getExplorationAdminItems(
  items: AdminCommandItem[],
  excludeHrefs: string[],
  limit = 6,
): AdminCommandItem[] {
  const used = new Set(excludeHrefs);

  return [...items]
    .filter((item) => !used.has(item.href))
    .sort(
      (a, b) =>
        (b.boost ?? 0) - (a.boost ?? 0) ||
        a.group.localeCompare(b.group) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, limit);
}

export function getAdminRoleFocus(user: SessionUser | null | undefined): AdminRoleFocus {
  switch (user?.role) {
    case 'FINANCE':
    case 'FINANCE_OPERATOR':
      return {
        eyebrow: 'ROLE PRIORITY',
        title: 'Finance focus',
        description: 'These actions keep reporting, payout, ledger, and reconciliation work close to hand.',
      };
    case 'MARKETING_MANAGER':
    case 'MARKETING_OPERATOR':
      return {
        eyebrow: 'ROLE PRIORITY',
        title: 'Growth focus',
        description: 'These actions keep campaign, content, approval, and asset work grouped together.',
      };
    case 'CONTENT_EDITOR':
      return {
        eyebrow: 'ROLE PRIORITY',
        title: 'Editorial focus',
        description: 'These actions keep publishing, assets, journal, and content systems aligned.',
      };
    case 'QC_TEAM':
      return {
        eyebrow: 'ROLE PRIORITY',
        title: 'Quality focus',
        description: 'These actions prioritize dispute handling, review quality, and marketplace verification surfaces.',
      };
    default:
      return {
        eyebrow: 'ROLE PRIORITY',
        title: 'Platform focus',
        description: 'These actions keep the highest-value operating surfaces close for admins and operators.',
      };
  }
}