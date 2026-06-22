// Fulfilment helpers — pre-order deposit math and limited-drop availability.
// Sprint 9.3.

import { effectivePricePaise } from '@/lib/money';

function priceOf(p: FulfilmentProduct): number {
  const r = effectivePricePaise(p.sellingPrice, p.salePrice ?? null, p.saleStartsAt ?? null, p.saleEndsAt ?? null);
  return r.price;
}

export type FulfilmentMode = 'IN_STOCK' | 'PREORDER' | 'LIMITED_DROP';

export interface FulfilmentProduct {
  fulfilmentMode?: FulfilmentMode | null;
  depositPercent?: number | null;
  releaseDate?: Date | string | null;
  editionSize?: number | null;
  editionSold?: number | null;
  sellingPrice: number;          // paise
  salePrice?: number | null;     // paise
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
}

/** Is this a piece that requires a deposit instead of full payment? */
export function isPreorder(p: FulfilmentProduct): boolean {
  return p.fulfilmentMode === 'PREORDER';
}

/** Is this a numbered, limited piece? */
export function isLimitedDrop(p: FulfilmentProduct): boolean {
  return p.fulfilmentMode === 'LIMITED_DROP';
}

/** For LIMITED_DROP: how many remain? Returns null for non-limited pieces. */
export function editionRemaining(p: FulfilmentProduct): number | null {
  if (!isLimitedDrop(p)) return null;
  const size = p.editionSize ?? 0;
  const sold = p.editionSold ?? 0;
  return Math.max(0, size - sold);
}

/** For LIMITED_DROP: is the edition fully sold? */
export function isSoldOut(p: FulfilmentProduct): boolean {
  if (!isLimitedDrop(p)) return false;
  const remaining = editionRemaining(p);
  return remaining !== null && remaining <= 0;
}

/**
 * Compute the amount the customer pays at checkout for this piece.
 *  - IN_STOCK / LIMITED_DROP → full effective price
 *  - PREORDER → depositPercent% of the effective price (rounded to nearest rupee)
 */
export function checkoutPaise(p: FulfilmentProduct): number {
  const full = priceOf(p);
  if (!isPreorder(p)) return full;
  const pct = clampPercent(p.depositPercent ?? 20);
  // Round to nearest whole rupee (100 paise) so amounts read clean
  const deposit = Math.round((full * pct) / 100 / 100) * 100;
  return Math.max(deposit, 100); // never less than ₹1
}

/** For preorder: how much balance is owed after deposit is paid? */
export function balancePaise(p: FulfilmentProduct): number {
  if (!isPreorder(p)) return 0;
  const full = priceOf(p);
  const deposit = checkoutPaise(p);
  return Math.max(0, full - deposit);
}

/** Clamp depositPercent into [1, 100] */
export function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 20;
  return Math.min(100, Math.max(1, Math.round(n)));
}

/** Human-readable label for the buy CTA. */
export function buyCtaLabel(p: FulfilmentProduct): string {
  if (isPreorder(p)) {
    const pct = p.depositPercent ?? 20;
    return `Reserve with ${pct}% deposit`;
  }
  if (isSoldOut(p)) return 'Sold out';
  return 'Add to trunk';
}

/** A short status line for PDPs and product cards. */
export function fulfilmentStatusLine(p: FulfilmentProduct): string | null {
  if (isPreorder(p)) {
    const release = p.releaseDate ? new Date(p.releaseDate) : null;
    if (release && !isNaN(release.getTime())) {
      const dateStr = release.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      return `Pre-order · Ships from ${dateStr}`;
    }
    return 'Pre-order · Ships when ready';
  }
  if (isLimitedDrop(p)) {
    const size = p.editionSize ?? 0;
    const remaining = editionRemaining(p);
    if (remaining === null) return null;
    if (remaining === 0) return `Edition of ${size} · Sold out`;
    if (remaining <= 3) return `Edition of ${size} · ${remaining} remaining`;
    return `Edition of ${size}`;
  }
  return null;
}
