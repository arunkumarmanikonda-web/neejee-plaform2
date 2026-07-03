export type ProductBadgeTone =
  | 'default'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

export type ProductReadBadge = {
  label: string;
  slug: string;
  tone: ProductBadgeTone;
  source: string | null;
  priority: number;
};

export type ProductBadgeInput =
  | string
  | {
      label?: unknown;
      text?: unknown;
      name?: unknown;
      title?: unknown;
      slug?: unknown;
      key?: unknown;
      tone?: unknown;
      variant?: unknown;
      source?: unknown;
      priority?: unknown;
      active?: unknown;
      enabled?: unknown;
    };

export type ProductBadgeSourceRow = {
  badges?: unknown;
  badge?: unknown;
  badgeLabel?: unknown;
  badgeText?: unknown;
  ribbon?: unknown;
  labels?: unknown;
  tags?: unknown;
};

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return null;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTone(value: unknown): ProductBadgeTone {
  const normalized = asString(value)?.toLowerCase();

  switch (normalized) {
    case 'accent':
    case 'success':
    case 'warning':
    case 'danger':
    case 'neutral':
    case 'default':
      return normalized;
    case 'primary':
    case 'brand':
    case 'featured':
      return 'accent';
    case 'error':
      return 'danger';
    case 'info':
      return 'default';
    default:
      return 'default';
  }
}

function toInputArray(value: unknown): ProductBadgeInput[] {
  if (Array.isArray(value)) {
    return value as ProductBadgeInput[];
  }

  if (value == null) {
    return [];
  }

  return [value as ProductBadgeInput];
}

function normalizeBadge(
  input: ProductBadgeInput,
  fallbackSource: string | null,
): ProductReadBadge | null {
  if (typeof input === 'string') {
    const label = asString(input);
    if (!label) {
      return null;
    }

    return {
      label,
      slug: slugify(label),
      tone: 'default',
      source: fallbackSource,
      priority: 0,
    };
  }

  const enabled = asBoolean(input.enabled);
  if (enabled === false) {
    return null;
  }

  const active = asBoolean(input.active);
  if (active === false) {
    return null;
  }

  const label =
    asString(input.label) ??
    asString(input.text) ??
    asString(input.name) ??
    asString(input.title);

  if (!label) {
    return null;
  }

  return {
    label,
    slug: asString(input.slug) ?? asString(input.key) ?? slugify(label),
    tone: normalizeTone(input.tone ?? input.variant),
    source: asString(input.source) ?? fallbackSource,
    priority: asNumber(input.priority) ?? 0,
  };
}

function pushUniqueBadge(
  target: ProductReadBadge[],
  badge: ProductReadBadge | null,
): void {
  if (!badge) {
    return;
  }

  const existingIndex = target.findIndex(
    (item) => item.slug === badge.slug || item.label === badge.label,
  );

  if (existingIndex === -1) {
    target.push(badge);
    return;
  }

  const existing = target[existingIndex];

  target[existingIndex] = {
    label: existing.label ?? badge.label,
    slug: existing.slug || badge.slug,
    tone: existing.tone !== 'default' ? existing.tone : badge.tone,
    source: existing.source ?? badge.source,
    priority: Math.min(existing.priority, badge.priority),
  };
}

export function buildBadges(source: ProductBadgeSourceRow): ProductReadBadge[] {
  const badges: ProductReadBadge[] = [];

  const sources: Array<[unknown, string | null]> = [
    [source.badges, 'badges'],
    [source.badge, 'badge'],
    [source.badgeLabel, 'badgeLabel'],
    [source.badgeText, 'badgeText'],
    [source.ribbon, 'ribbon'],
    [source.labels, 'labels'],
    [source.tags, 'tags'],
  ];

  for (const [value, fallbackSource] of sources) {
    for (const input of toInputArray(value)) {
      pushUniqueBadge(badges, normalizeBadge(input, fallbackSource));
    }
  }

  return badges.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    return a.label.localeCompare(b.label);
  });
}
