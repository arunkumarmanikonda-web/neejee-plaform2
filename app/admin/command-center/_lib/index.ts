import type {
  CommandAction,
  CommandCenterGroupedResults,
  CommandCenterResult,
  CommandCenterSearchResponse,
} from './contract';

type SearchableEntry = Omit<
  CommandCenterResult,
  'score' | 'matchedFields' | 'reason'
> & {
  keywords: string[];
  priority: number;
};

const openAction = (href: string): CommandAction => ({
  id: 'open',
  label: 'Open',
  href,
});

const copyLinkAction = (href: string): CommandAction => ({
  id: 'copy-link',
  label: 'Copy link',
  href,
});

const SEARCHABLE_ENTRIES: SearchableEntry[] = [
  {
    id: 'cmd-dashboard',
    kind: 'command',
    title: 'Open admin dashboard',
    subtitle: 'Jump to the main operator surface',
    href: '/admin',
    keywords: ['dashboard', 'home', 'overview', 'admin'],
    actions: [openAction('/admin'), copyLinkAction('/admin')],
    priority: 100,
  },
  {
    id: 'cmd-command-center',
    kind: 'command',
    title: 'Open AI command center',
    subtitle: 'Global operator search, quick actions, and ranked navigation',
    href: '/admin/command-center',
    keywords: ['command center', 'search', 'palette', 'operator', 'ai'],
    actions: [
      openAction('/admin/command-center'),
      copyLinkAction('/admin/command-center'),
    ],
    priority: 99,
  },
  {
    id: 'page-sellers',
    kind: 'seller',
    title: 'Seller operations',
    subtitle: 'Review sellers, onboarding, and merchant state',
    href: '/admin/sellers',
    keywords: ['seller', 'merchant', 'onboarding', 'approval', 'review'],
    actions: [
      openAction('/admin/sellers'),
      { id: 'review', label: 'Review', href: '/admin/sellers' },
      copyLinkAction('/admin/sellers'),
    ],
    priority: 95,
  },
  {
    id: 'page-kyc',
    kind: 'kyc',
    title: 'KYC onboarding queue',
    subtitle: 'PAN, GST, bank verification, and status review',
    href: '/admin/seller-onboarding',
    keywords: ['kyc', 'pan', 'gst', 'bank', 'verify', 'verification', 'seller onboarding'],
    actions: [
      openAction('/admin/seller-onboarding'),
      { id: 'verify', label: 'Verify', href: '/admin/seller-onboarding' },
      { id: 'review', label: 'Review', href: '/admin/seller-onboarding' },
      copyLinkAction('/admin/seller-onboarding'),
    ],
    priority: 97,
  },
  {
    id: 'page-orders',
    kind: 'order',
    title: 'Order operations',
    subtitle: 'Inspect order state, payment state, and fulfillment issues',
    href: '/admin/orders',
    keywords: ['orders', 'payments', 'refunds', 'fulfillment', 'dispatch'],
    actions: [openAction('/admin/orders'), copyLinkAction('/admin/orders')],
    priority: 92,
  },
  {
    id: 'page-users',
    kind: 'user',
    title: 'User directory',
    subtitle: 'Search users, support accounts, and operator-linked records',
    href: '/admin/users',
    keywords: ['users', 'accounts', 'customers', 'operators', 'profiles'],
    actions: [openAction('/admin/users'), copyLinkAction('/admin/users')],
    priority: 90,
  },
  {
    id: 'page-catalog',
    kind: 'catalog',
    title: 'Catalogue operations',
    subtitle: 'Inspect catalogue entities, content, and publishing state',
    href: '/admin/catalogue',
    keywords: ['catalogue', 'catalog', 'products', 'content', 'publishing'],
    actions: [openAction('/admin/catalogue'), copyLinkAction('/admin/catalogue')],
    priority: 89,
  },
  {
    id: 'page-tickets',
    kind: 'ticket',
    title: 'Support tickets',
    subtitle: 'Review support issues and operator escalations',
    href: '/admin/tickets',
    keywords: ['tickets', 'support', 'issues', 'escalations', 'helpdesk'],
    actions: [openAction('/admin/tickets'), copyLinkAction('/admin/tickets')],
    priority: 86,
  },
  {
    id: 'page-seo',
    kind: 'seo',
    title: 'SEO control plane',
    subtitle: 'Metadata, search discoverability, and governance',
    href: '/admin/seo',
    keywords: ['seo', 'metadata', 'sem', 'discoverability', 'search'],
    actions: [openAction('/admin/seo'), copyLinkAction('/admin/seo')],
    priority: 84,
  },
  {
    id: 'page-settings',
    kind: 'setting',
    title: 'Admin settings',
    subtitle: 'System configuration, policies, and operator controls',
    href: '/admin/settings',
    keywords: ['settings', 'config', 'configuration', 'policies', 'controls'],
    actions: [openAction('/admin/settings'), copyLinkAction('/admin/settings')],
    priority: 83,
  },
];

function normalizeText(input: string): string {
  return input.trim().toLowerCase();
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreEntry(
  queryText: string,
  tokens: string[],
  entry: SearchableEntry,
): CommandCenterResult | null {
  if (!queryText) {
    return {
      ...entry,
      score: entry.priority,
      matchedFields: ['priority'],
      reason: 'default-priority',
    };
  }

  let score = entry.priority;
  const matchedFields = new Set<string>();

  const title = normalizeText(entry.title);
  const subtitle = normalizeText(entry.subtitle);
  const href = normalizeText(entry.href);
  const keywords = entry.keywords.map(normalizeText);

  if (title.includes(queryText)) {
    score += 80;
    matchedFields.add('title');
  }

  if (subtitle.includes(queryText)) {
    score += 35;
    matchedFields.add('subtitle');
  }

  if (href.includes(queryText)) {
    score += 20;
    matchedFields.add('href');
  }

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 18;
      matchedFields.add('title');
    }
    if (subtitle.includes(token)) {
      score += 8;
      matchedFields.add('subtitle');
    }
    if (href.includes(token)) {
      score += 4;
      matchedFields.add('href');
    }
    if (keywords.some((keyword) => keyword.includes(token))) {
      score += 12;
      matchedFields.add('keywords');
    }
  }

  if (matchedFields.size === 0) {
    return null;
  }

  return {
    ...entry,
    score,
    matchedFields: Array.from(matchedFields),
    reason: 'ranked-match',
  };
}

export function searchCommandCenter(
  query: string,
  limit = 24,
): CommandCenterSearchResponse {
  const queryText = normalizeText(query);
  const tokens = tokenize(query);

  const ranked = SEARCHABLE_ENTRIES.map((entry) =>
    scoreEntry(queryText, tokens, entry),
  )
    .filter((entry): entry is CommandCenterResult => Boolean(entry))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  const grouped: CommandCenterGroupedResults = {};
  for (const result of ranked) {
    const bucket = grouped[result.kind] ?? [];
    bucket.push(result);
    grouped[result.kind] = bucket;
  }

  return {
    query: queryText,
    total: ranked.length,
    grouped,
    results: ranked,
  };
}
