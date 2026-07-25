import type { AdminCommandItem } from '@/lib/admin/admin-command-catalog';

type AdminCommandUsageState = {
  recent: string[];
  counts: Record<string, number>;
  updatedAt: string | null;
};

export type AdminCommandInsights = {
  recentItems: AdminCommandItem[];
  frequentItems: AdminCommandItem[];
  suggestedItems: AdminCommandItem[];
};

const STORAGE_KEY = 'neejee.admin.command-usage.v1';
const RECENT_LIMIT = 8;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function emptyState(): AdminCommandUsageState {
  return {
    recent: [],
    counts: {},
    updatedAt: null,
  };
}

export function getAdminCommandUsageState(): AdminCommandUsageState {
  if (!canUseStorage()) return emptyState();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();

    const parsed = JSON.parse(raw) as Partial<AdminCommandUsageState>;
    return {
      recent: Array.isArray(parsed.recent)
        ? parsed.recent.filter((value): value is string => typeof value === 'string')
        : [],
      counts: parsed.counts && typeof parsed.counts === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.counts).filter(
              (entry): entry is [string, number] =>
                typeof entry[0] === 'string' &&
                typeof entry[1] === 'number' &&
                Number.isFinite(entry[1]),
            ),
          )
        : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: AdminCommandUsageState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function recordAdminCommandUsage(href: string) {
  const state = getAdminCommandUsageState();
  const recent = [href, ...state.recent.filter((item) => item !== href)].slice(0, RECENT_LIMIT);
  const counts = {
    ...state.counts,
    [href]: (state.counts[href] ?? 0) + 1,
  };

  writeState({
    recent,
    counts,
    updatedAt: new Date().toISOString(),
  });
}

export function getAdminCommandInsights(
  items: AdminCommandItem[],
  limit = 6,
): AdminCommandInsights {
  const state = getAdminCommandUsageState();
  const byHref = new Map(items.map((item) => [item.href, item]));

  const recentItems: AdminCommandItem[] = state.recent
    .map((href) => byHref.get(href))
    .filter((item): item is AdminCommandItem => Boolean(item))
    .slice(0, limit);

  const frequentItems: AdminCommandItem[] = Object.entries(state.counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([href]) => byHref.get(href))
    .filter((item): item is AdminCommandItem => Boolean(item))
    .slice(0, limit);

  const used = new Set([...recentItems, ...frequentItems].map((item) => item.href));

  const suggestedItems: AdminCommandItem[] = items
    .filter((item) => !used.has(item.href))
    .slice(0, limit);

  return {
    recentItems,
    frequentItems,
    suggestedItems,
  };
}