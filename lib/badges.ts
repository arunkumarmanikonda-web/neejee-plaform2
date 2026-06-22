// NEEJEE product seal/badge catalog.
// Hand-stamped seals tied to specific brand-trust signals.
// Each product can carry zero or more of these.

export type BadgeKey =
  | 'FOUNDERS_EDIT'
  | 'NEEJEE_SELECT'
  | 'ARTISAN_MADE'
  | 'HANDLOOM_VERIFIED'
  | 'LIMITED_DROP'
  | 'AUTHENTICITY_GUARANTEED'
  | 'FAIR_TRADE'
  | 'SLOW_MADE';

export interface BadgeMeta {
  key: BadgeKey;
  label: string;        // What appears on the seal
  description: string;  // Tooltip / longer explanation
  group: 'trust' | 'craft' | 'editorial';
}

export const BADGE_CATALOG: BadgeMeta[] = [
  {
    key: 'FOUNDERS_EDIT',
    label: "Founder's Edit",
    description: "Personally chosen by Nidhi for this season's edit.",
    group: 'editorial',
  },
  {
    key: 'NEEJEE_SELECT',
    label: 'NEEJEE Select',
    description: 'Hand-picked by the NEEJEE atelier as a definitive piece.',
    group: 'editorial',
  },
  {
    key: 'ARTISAN_MADE',
    label: 'Artisan Made',
    description: 'Made by hand by a named artisan, not a factory line.',
    group: 'craft',
  },
  {
    key: 'HANDLOOM_VERIFIED',
    label: 'Handloom Verified',
    description: 'Woven on a traditional handloom. We have inspected the loom.',
    group: 'craft',
  },
  {
    key: 'LIMITED_DROP',
    label: 'Limited Drop',
    description: 'A small, numbered drop. When it sells, it sells.',
    group: 'editorial',
  },
  {
    key: 'AUTHENTICITY_GUARANTEED',
    label: 'Authenticity Guaranteed',
    description: 'Provenance documented. We stake our name on it.',
    group: 'trust',
  },
  {
    key: 'FAIR_TRADE',
    label: 'Fair Trade',
    description: 'Artisans paid above-market rates. No middlemen.',
    group: 'trust',
  },
  {
    key: 'SLOW_MADE',
    label: 'Slow Made',
    description: 'Took weeks or months to make. As it should.',
    group: 'craft',
  },
];

export const BADGE_BY_KEY: Record<BadgeKey, BadgeMeta> =
  BADGE_CATALOG.reduce((acc, b) => { acc[b.key] = b; return acc; }, {} as Record<BadgeKey, BadgeMeta>);

/** Filter a raw string[] from DB down to known valid badges */
export function validBadges(input: string[] | null | undefined): BadgeMeta[] {
  if (!input) return [];
  return input
    .map(k => BADGE_BY_KEY[k as BadgeKey])
    .filter((b): b is BadgeMeta => !!b);
}
