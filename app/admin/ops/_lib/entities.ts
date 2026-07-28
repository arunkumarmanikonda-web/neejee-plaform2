export type CrudActionId =
  | 'open-list'
  | 'create'
  | 'bulk-edit'
  | 'review-queue'
  | 'settings';

export type CrudAction = {
  id: CrudActionId;
  label: string;
  href: string;
};

export type CrudEntityDescriptor = {
  slug: string;
  title: string;
  subtitle: string;
  domain: 'marketplace' | 'catalog' | 'operations' | 'growth' | 'system';
  description: string;
  href: string;
  actions: CrudAction[];
  badges: string[];
};

export const CRUD_ENTITIES: CrudEntityDescriptor[] = [
  {
    slug: 'sellers',
    title: 'Sellers',
    subtitle: 'Merchant profiles, onboarding, approvals, and operational state',
    domain: 'marketplace',
    description: 'Primary seller management workspace with review-oriented CRUD affordances.',
    href: '/admin/sellers',
    actions: [
      { id: 'open-list', label: 'Open list', href: '/admin/sellers' },
      { id: 'create', label: 'Create', href: '/admin/sellers' },
      { id: 'review-queue', label: 'Review queue', href: '/admin/seller-onboarding' },
    ],
    badges: ['Marketplace', 'Review', 'CRUD'],
  },
  {
    slug: 'kyc',
    title: 'Seller onboarding / KYC',
    subtitle: 'PAN, GST, bank verification, and exception review',
    domain: 'marketplace',
    description: 'AI-first verification queue with status-driven operator review.',
    href: '/admin/seller-onboarding',
    actions: [
      { id: 'open-list', label: 'Open queue', href: '/admin/seller-onboarding' },
      { id: 'review-queue', label: 'Review queue', href: '/admin/seller-onboarding' },
    ],
    badges: ['KYC', 'Verification', 'Review'],
  },
  {
    slug: 'orders',
    title: 'Orders',
    subtitle: 'Order state, payment state, fulfillment, and intervention workflows',
    domain: 'operations',
    description: 'Operational order workspace for high-frequency support and fulfillment actions.',
    href: '/admin/orders',
    actions: [
      { id: 'open-list', label: 'Open list', href: '/admin/orders' },
      { id: 'bulk-edit', label: 'Bulk edit', href: '/admin/orders' },
    ],
    badges: ['Operations', 'Bulk', 'Queue'],
  },
  {
    slug: 'users',
    title: 'Users',
    subtitle: 'Profiles, support-driven lookups, and account operations',
    domain: 'operations',
    description: 'User record workspace for support and lifecycle management.',
    href: '/admin/users',
    actions: [
      { id: 'open-list', label: 'Open list', href: '/admin/users' },
      { id: 'create', label: 'Create', href: '/admin/users' },
      { id: 'bulk-edit', label: 'Bulk edit', href: '/admin/users' },
    ],
    badges: ['Accounts', 'Support', 'CRUD'],
  },
  {
    slug: 'catalogue',
    title: 'Catalogue',
    subtitle: 'Products, pricing, media, categories, and publishing state',
    domain: 'catalog',
    description: 'Deep product CRUD workspace for catalogue operations.',
    href: '/admin/catalogue',
    actions: [
      { id: 'open-list', label: 'Open list', href: '/admin/catalogue' },
      { id: 'create', label: 'Create', href: '/admin/catalogue' },
      { id: 'bulk-edit', label: 'Bulk edit', href: '/admin/catalogue' },
    ],
    badges: ['Catalog', 'Pricing', 'Media'],
  },
  {
    slug: 'tickets',
    title: 'Support tickets',
    subtitle: 'Escalations, issue resolution, and operator handoff queues',
    domain: 'operations',
    description: 'Support issue CRUD shell with queue-first workflows.',
    href: '/admin/tickets',
    actions: [
      { id: 'open-list', label: 'Open list', href: '/admin/tickets' },
      { id: 'review-queue', label: 'Review queue', href: '/admin/tickets' },
    ],
    badges: ['Support', 'Queue'],
  },
  {
    slug: 'seo',
    title: 'SEO control plane',
    subtitle: 'Metadata, discoverability, and search governance operations',
    domain: 'growth',
    description: 'Governance workspace for search visibility and metadata operations.',
    href: '/admin/seo',
    actions: [
      { id: 'open-list', label: 'Open list', href: '/admin/seo' },
      { id: 'settings', label: 'Settings', href: '/admin/seo' },
    ],
    badges: ['SEO', 'Metadata'],
  },
  {
    slug: 'settings',
    title: 'Admin settings',
    subtitle: 'Operator policies, configuration, and system controls',
    domain: 'system',
    description: 'System configuration workspace with consistency-focused UX.',
    href: '/admin/settings',
    actions: [
      { id: 'open-list', label: 'Open settings', href: '/admin/settings' },
      { id: 'settings', label: 'Settings', href: '/admin/settings' },
    ],
    badges: ['System', 'Controls'],
  },
];

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function searchCrudEntities(query: string): CrudEntityDescriptor[] {
  const q = normalize(query);
  if (!q) return CRUD_ENTITIES;

  return CRUD_ENTITIES.filter((entity) => {
    const haystack = [
      entity.slug,
      entity.title,
      entity.subtitle,
      entity.domain,
      entity.description,
      ...entity.badges,
      ...entity.actions.map((action) => action.label),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function getCrudEntityBySlug(slug: string): CrudEntityDescriptor | undefined {
  return CRUD_ENTITIES.find((entity) => entity.slug === slug);
}
