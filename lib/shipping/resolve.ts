// lib/shipping/resolve.ts
// Picks the best ShippingZone for a destination and returns the cost
// to charge for STANDARD / EXPRESS shipping. Falls back to legacy hardcoded
// rates if no zones exist.

import { prisma } from '@/lib/prisma';

// Legacy fallback (matches the original app/api/checkout/route.ts values).
const LEGACY_FREE_ABOVE_PAISE = 250000;
const LEGACY_STANDARD_PAISE   = 15000;
const LEGACY_EXPRESS_PAISE    = 25000;

export interface ShippingResolveInput {
  pincode?: string | null;
  state?: string | null;
  subtotalPaise: number;
  mode: 'STANDARD' | 'EXPRESS';
}

export interface ShippingResolveResult {
  shippingPaise: number;        // amount to add to the cart (0 when inclusive)
  inclusive: boolean;            // when true the brand absorbs the cost
  freeAboveSubtotalPaise: number;
  zoneId: string | null;
  zoneName: string;
  reason: 'matched-prefix' | 'matched-exact' | 'matched-state' | 'default' | 'legacy';
}

function matchesZone(
  zone: { pincodeExact: string[]; pincodePrefixes: string[]; states: string[] },
  pincode: string | null | undefined,
  state: string | null | undefined,
): null | 'matched-exact' | 'matched-prefix' | 'matched-state' {
  const p = (pincode || '').trim();
  const s = (state || '').trim().toLowerCase();
  if (p && zone.pincodeExact.length && zone.pincodeExact.includes(p)) return 'matched-exact';
  if (p && zone.pincodePrefixes.length) {
    if (zone.pincodePrefixes.some(pref => p.startsWith(pref))) return 'matched-prefix';
  }
  if (s && zone.states.length) {
    if (zone.states.some(zs => zs.toLowerCase() === s)) return 'matched-state';
  }
  return null;
}

export async function resolveShipping(input: ShippingResolveInput): Promise<ShippingResolveResult> {
  const { pincode, state, subtotalPaise, mode } = input;

  let zones: any[] = [];
  try {
    zones = await prisma.shippingZone.findMany({
      where: { active: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  } catch {
    // ShippingZone table may not exist yet — fall back gracefully
    zones = [];
  }

  // 1) Try non-default zones first, in priority order
  let matchedReason: ShippingResolveResult['reason'] | null = null;
  let matched: any = null;
  for (const z of zones) {
    if (z.isDefault) continue;
    const r = matchesZone(z, pincode, state);
    if (r) {
      matched = z;
      matchedReason = r;
      break;
    }
  }

  // 2) Fall back to the default zone
  if (!matched) {
    matched = zones.find(z => z.isDefault) || null;
    if (matched) matchedReason = 'default';
  }

  // 3) Hardcoded legacy fallback
  if (!matched) {
    const free = subtotalPaise >= LEGACY_FREE_ABOVE_PAISE;
    return {
      shippingPaise: free ? 0 : (mode === 'EXPRESS' ? LEGACY_EXPRESS_PAISE : LEGACY_STANDARD_PAISE),
      inclusive: false,
      freeAboveSubtotalPaise: LEGACY_FREE_ABOVE_PAISE,
      zoneId: null,
      zoneName: 'Legacy fallback',
      reason: 'legacy',
    };
  }

  // Compute final shipping paise from the matched zone
  const isFree = subtotalPaise >= matched.freeAboveSubtotalPaise;
  let shippingPaise = isFree ? 0 : (mode === 'EXPRESS' ? matched.expressPaise : matched.standardPaise);

  // Inclusive zones absorb the cost — customer pays 0, brand books the cost internally
  if (matched.inclusive) shippingPaise = 0;

  return {
    shippingPaise,
    inclusive: !!matched.inclusive,
    freeAboveSubtotalPaise: matched.freeAboveSubtotalPaise,
    zoneId: matched.id,
    zoneName: matched.name,
    reason: matchedReason || 'default',
  };
}

// Helper used by the admin UI: round any rupee value to the nearest ₹50
// for consistency. Returns paise.
export function roundToNearest50Rupees(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees < 0) return 0;
  const rounded = Math.round(rupees / 50) * 50;
  return rounded * 100; // -> paise
}
