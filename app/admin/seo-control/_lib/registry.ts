export type SeoSurfaceType =
  | 'page'
  | 'collection'
  | 'campaign'
  | 'product'
  | 'system';

export type SeoValidationState = 'healthy' | 'warning' | 'needs-review';

export type SeoAction = {
  id: 'open' | 'edit-metadata' | 'preview-serp' | 'review-sem' | 'publish';
  label: string;
  href: string;
};

export type SeoControlPlaneEntry = {
  id: string;
  slug: string;
  title: string;
  surfaceType: SeoSurfaceType;
  route: string;
  metadataTitle: string;
  metadataDescription: string;
  canonicalUrl: string;
  semCampaign: string;
  validationState: SeoValidationState;
  issues: string[];
  owner: string;
  updatedAt: string;
  actions: SeoAction[];
};

export const SEO_CONTROL_PLANE_ENTRIES: SeoControlPlaneEntry[] = [
  {
    id: 'seo-home',
    slug: 'home',
    title: 'Homepage metadata',
    surfaceType: 'page',
    route: '/',
    metadataTitle: 'NeeJee — Found. Personal. Premium Indian craft',
    metadataDescription: 'Premium Indian craft ecommerce and marketplace with AI-assisted discovery.',
    canonicalUrl: 'https://neejee.com/',
    semCampaign: 'brand-core',
    validationState: 'healthy',
    issues: [],
    owner: 'Growth',
    updatedAt: '2026-07-28T00:00:00.000Z',
    actions: [
      { id: 'open', label: 'Open route', href: '/' },
      { id: 'edit-metadata', label: 'Edit metadata', href: '/admin/seo-control' },
      { id: 'preview-serp', label: 'Preview SERP', href: '/admin/seo-control' },
    ],
  },
  {
    id: 'seo-catalogue',
    slug: 'catalogue',
    title: 'Catalogue landing metadata',
    surfaceType: 'collection',
    route: '/catalogue',
    metadataTitle: 'Catalogue — Premium craft collections',
    metadataDescription: 'Browse curated catalogue collections with premium craft stories and merchandising.',
    canonicalUrl: 'https://neejee.com/catalogue',
    semCampaign: 'catalogue-discovery',
    validationState: 'healthy',
    issues: [],
    owner: 'Catalog',
    updatedAt: '2026-07-28T00:00:00.000Z',
    actions: [
      { id: 'open', label: 'Open route', href: '/catalogue' },
      { id: 'edit-metadata', label: 'Edit metadata', href: '/admin/seo-control' },
      { id: 'preview-serp', label: 'Preview SERP', href: '/admin/seo-control' },
    ],
  },
  {
    id: 'seo-sellers',
    slug: 'seller-onboarding',
    title: 'Seller onboarding discoverability',
    surfaceType: 'campaign',
    route: '/sell',
    metadataTitle: 'Sell on NeeJee — Premium craft marketplace onboarding',
    metadataDescription: 'Join the marketplace with structured seller onboarding, KYC verification, and merchant enablement.',
    canonicalUrl: 'https://neejee.com/sell',
    semCampaign: 'seller-acquisition',
    validationState: 'warning',
    issues: ['Review campaign keyword alignment', 'Confirm final onboarding CTA copy'],
    owner: 'Marketplace',
    updatedAt: '2026-07-28T00:00:00.000Z',
    actions: [
      { id: 'open', label: 'Open route', href: '/sell' },
      { id: 'review-sem', label: 'Review SEM', href: '/admin/seo-control' },
      { id: 'edit-metadata', label: 'Edit metadata', href: '/admin/seo-control' },
    ],
  },
  {
    id: 'seo-product-template',
    slug: 'product-template',
    title: 'Product template metadata policy',
    surfaceType: 'product',
    route: '/products/[slug]',
    metadataTitle: 'Product template policy',
    metadataDescription: 'Template-driven metadata policy for product-level discoverability.',
    canonicalUrl: 'https://neejee.com/products/[slug]',
    semCampaign: 'product-long-tail',
    validationState: 'warning',
    issues: ['Validate dynamic title composition', 'Confirm structured snippet consistency'],
    owner: 'Catalog',
    updatedAt: '2026-07-28T00:00:00.000Z',
    actions: [
      { id: 'edit-metadata', label: 'Edit metadata', href: '/admin/seo-control' },
      { id: 'preview-serp', label: 'Preview SERP', href: '/admin/seo-control' },
      { id: 'publish', label: 'Publish policy', href: '/admin/seo-control' },
    ],
  },
  {
    id: 'seo-system-governance',
    slug: 'governance',
    title: 'SEO governance checklist',
    surfaceType: 'system',
    route: '/admin/seo-control',
    metadataTitle: 'SEO governance and launch checklist',
    metadataDescription: 'Launch-grade metadata governance, validation, and SEM workflow coverage.',
    canonicalUrl: 'https://neejee.com/admin/seo-control',
    semCampaign: 'governance',
    validationState: 'needs-review',
    issues: ['Final launch owner signoff pending', 'Review metadata QA handoff'],
    owner: 'Growth Ops',
    updatedAt: '2026-07-28T00:00:00.000Z',
    actions: [
      { id: 'open', label: 'Open control plane', href: '/admin/seo-control' },
      { id: 'review-sem', label: 'Review SEM', href: '/admin/seo-control' },
      { id: 'publish', label: 'Publish checklist', href: '/admin/seo-control' },
    ],
  },
];

function normalize(input: string): string {
  return input.trim().toLowerCase();
}

export function filterSeoEntries(query: string): SeoControlPlaneEntry[] {
  const q = normalize(query);
  if (!q) return SEO_CONTROL_PLANE_ENTRIES;

  return SEO_CONTROL_PLANE_ENTRIES.filter((entry) => {
    const haystack = [
      entry.slug,
      entry.title,
      entry.surfaceType,
      entry.route,
      entry.metadataTitle,
      entry.metadataDescription,
      entry.semCampaign,
      entry.validationState,
      entry.owner,
      ...entry.issues,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function summarizeSeoValidation(entries: SeoControlPlaneEntry[]) {
  return {
    total: entries.length,
    healthy: entries.filter((entry) => entry.validationState === 'healthy').length,
    warning: entries.filter((entry) => entry.validationState === 'warning').length,
    needsReview: entries.filter((entry) => entry.validationState === 'needs-review').length,
  };
}
