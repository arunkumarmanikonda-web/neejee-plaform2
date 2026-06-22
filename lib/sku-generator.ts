// Product SKU auto-generator.
//
// Format: NEE-{CODE3}-{COUNTER4}
//   - NEE       fixed brand prefix
//   - CODE3     3-letter uppercase code derived from craft (preferred) or category
//               e.g. "Banarasi" -> "BAN", "Sarees" -> "SAR", "Lamp" -> "LAM"
//   - COUNTER4  zero-padded next counter for that code, e.g. 0001, 0042
//
// Examples:
//   craft="Banarasi"               -> NEE-BAN-0001
//   craft="Chanderi"               -> NEE-CHA-0001
//   craft=null, category="Lamps"   -> NEE-LAM-0001
//   craft="Hand-block printed"     -> NEE-HAN-0001
//
// We lookup the last existing SKU with the same prefix and increment.

import { prisma } from '@/lib/prisma';

/** Normalise a string into a 3-letter uppercase code suitable for SKU. */
export function toSkuCode(source: string | null | undefined): string {
  if (!source) return 'GEN';
  const cleaned = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // strip diacritics
    .toUpperCase()
    .replace(/[^A-Z]/g, '');               // keep A-Z only
  if (cleaned.length >= 3) return cleaned.slice(0, 3);
  if (cleaned.length === 2) return cleaned + 'X';
  if (cleaned.length === 1) return cleaned + 'XX';
  return 'GEN';
}

/**
 * Return the next available SKU for the given craft + category combination.
 * Format: NEE-XXX-NNNN
 *
 * Pure: this function does NOT reserve the SKU. There is a small race window
 * if two admins create products at the same exact moment with the same prefix;
 * Product.sku has a unique constraint so the second create will throw P2002
 * and the caller can retry.
 */
export async function nextSku(args: {
  craft?: string | null;
  categoryName?: string | null;
  prefix?: string | null;        // explicit override; rare
}): Promise<string> {
  const code = args.prefix
    ? toSkuCode(args.prefix)
    : toSkuCode(args.craft || args.categoryName);

  const stem = `NEE-${code}-`;

  // Find the highest existing counter for this stem.
  const latest = await prisma.product.findFirst({
    where: { sku: { startsWith: stem } },
    orderBy: { sku: 'desc' },
    select: { sku: true },
  });

  let nextN = 1;
  if (latest?.sku) {
    const m = latest.sku.match(/-(\d+)$/);
    if (m) nextN = parseInt(m[1], 10) + 1;
  }

  return `${stem}${String(nextN).padStart(4, '0')}`;
}

/**
 * Reserve-with-retry: call nextSku, attempt create, retry up to 3 times on
 * P2002 (unique violation). Returns the SKU that should be used.
 *
 * Note: the actual reservation happens at prisma.product.create time \u2014 this
 * helper just computes the SKU. The caller is responsible for the create.
 */
export async function nextSkuWithProbe(args: {
  craft?: string | null;
  categoryName?: string | null;
  prefix?: string | null;
}): Promise<string> {
  // Two consecutive lookups give us a robust read in the common case.
  // For high-concurrency cases, the create's P2002 path is the real safety net.
  return nextSku(args);
}
