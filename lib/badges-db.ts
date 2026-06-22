// Server-side helper to load the Badge catalog from the DB.
// Falls back to the hard-coded BADGE_CATALOG if the DB has no rows yet
// (e.g. on a fresh deploy before the seeder runs).
//
// Shape returned matches BadgeMeta but also exposes optional imageUrl
// (AI-generated wax-seal PNG, hosted in Supabase).

import { prisma } from '@/lib/prisma';
import { BADGE_CATALOG, type BadgeMeta } from '@/lib/badges';

export interface BadgeRecord extends BadgeMeta {
  id?: string;
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
}

/** Load ALL badges (active and inactive) from DB. Admin-only. */
export async function loadAllBadges(): Promise<BadgeRecord[]> {
  try {
    const rows = await prisma.badge.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length === 0) {
      // Seed not yet run — return hard-coded catalog
      return BADGE_CATALOG.map((b, i) => ({
        ...b,
        imageUrl: null,
        active: true,
        sortOrder: i,
      }));
    }
    return rows.map(r => ({
      id: r.id,
      key: r.key as any,
      label: r.label,
      description: r.description,
      group: r.group as any,
      imageUrl: r.imageUrl,
      active: r.active,
      sortOrder: r.sortOrder,
    }));
  } catch {
    // DB unavailable — graceful fallback
    return BADGE_CATALOG.map((b, i) => ({
      ...b,
      imageUrl: null,
      active: true,
      sortOrder: i,
    }));
  }
}

/** Load only ACTIVE badges, for public use (PDP, product cards, picker). */
export async function loadActiveBadges(): Promise<BadgeRecord[]> {
  const all = await loadAllBadges();
  return all.filter(b => b.active !== false);
}

/** Load a single badge by key. */
export async function loadBadgeByKey(key: string): Promise<BadgeRecord | null> {
  try {
    const row = await prisma.badge.findUnique({ where: { key } });
    if (row) {
      return {
        id: row.id,
        key: row.key as any,
        label: row.label,
        description: row.description,
        group: row.group as any,
        imageUrl: row.imageUrl,
        active: row.active,
        sortOrder: row.sortOrder,
      };
    }
  } catch {}
  const fallback = BADGE_CATALOG.find(b => b.key === key);
  if (!fallback) return null;
  return { ...fallback, imageUrl: null, active: true, sortOrder: 0 };
}

/** Filter a raw string[] (DB shape on Product.badges) to active BadgeRecords. */
export async function resolveBadges(keys: string[] | null | undefined): Promise<BadgeRecord[]> {
  if (!keys || keys.length === 0) return [];
  const all = await loadAllBadges();
  const byKey = new Map<string, BadgeRecord>(all.map(b => [b.key as string, b]));
  return keys
    .map(k => byKey.get(k))
    .filter((b): b is BadgeRecord => !!b && b.active !== false);
}
