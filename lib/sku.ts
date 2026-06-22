// Auto-SKU generator for NEEJEE products.
// Format: {CAT3}-{CRAFT3}-{XXXX}
//   CAT3   = first 3 letters of category name (uppercase, alpha-only). e.g. "Sarees" -> SAR
//   CRAFT3 = first 3 letters of craft. e.g. "Banarasi Katan" -> BAN
//   XXXX   = 4-char base36 random suffix, collision-checked against DB
//
// Falls back to "NEE" when category or craft is missing.
// The random suffix guarantees that two products with the same category +
// craft (e.g. ten Banarasi sarees) get distinct SKUs.

import { prisma } from '@/lib/prisma';

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // base36 uppercase
const SUFFIX_LEN = 4;

function tag3(s: string | null | undefined, fallback: string): string {
  if (!s) return fallback;
  const cleaned = s.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (cleaned.length === 0) return fallback;
  return cleaned.slice(0, 3).padEnd(3, 'X');
}

function randSuffix(): string {
  let s = '';
  for (let i = 0; i < SUFFIX_LEN; i++) {
    s += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return s;
}

/**
 * Generate a SKU that is guaranteed unique in the Product table.
 * Loops up to 8 times trying fresh random suffixes; in practice the first
 * try succeeds (36^4 = 1.6M combinations per category+craft prefix).
 */
export async function generateSku(opts: {
  categoryName?: string | null;
  craft?: string | null;
}): Promise<string> {
  const catTag = tag3(opts.categoryName, 'NEE');
  const craftTag = tag3(opts.craft, 'XXX');
  const prefix = `${catTag}-${craftTag}`;

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = `${prefix}-${randSuffix()}`;
    const existing = await prisma.product.findUnique({ where: { sku: candidate } });
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback: append a timestamp
  return `${prefix}-${randSuffix()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}

/** Slugify a product name to a URL-safe slug, uniqued in DB. */
export async function generateSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';

  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    suffix++;
    candidate = `${base}-${suffix}`;
    if (suffix > 50) {
      // pathological — break out with random suffix
      return `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
  }
}
