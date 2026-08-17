'use client';
// Hand-stamped seal/badge in NEEJEE brand style.
// Renders a real PNG (AI-generated thappa seal) when available, otherwise
// falls back to a CSS-rendered madder circle so things still ship pre-AI.
import { useEffect, useMemo, useState } from 'react';
import { validBadges, BADGE_BY_KEY, type BadgeMeta, type BadgeKey } from '@/lib/badges';

export interface BadgeRecord extends BadgeMeta {
  imageUrl?: string | null;
}

type BadgeInput = string | {
  key?: string | null;
  label?: string | null;
  slug?: string | null;
};

interface BadgeProps {
  badge: BadgeRecord;
  size?: 'sm' | 'md' | 'lg';
}

function badgeKeyOf(input: BadgeInput): string | null {
  if (typeof input === 'string') return input.trim() || null;
  if (!input || typeof input !== 'object') return null;
  const raw = input.key || input.label || input.slug;
  if (!raw) return null;
  return String(raw).trim().replace(/-/g, '_').toUpperCase() || null;
}

function normalizeBadgeKeys(inputs: BadgeInput[] | null | undefined): string[] {
  if (!Array.isArray(inputs)) return [];
  return Array.from(new Set(inputs.map(badgeKeyOf).filter((key): key is string => !!key)));
}

export function Badge({ badge, size = 'md' }: BadgeProps) {
  const sizePx =
    size === 'sm' ? 64 :
    size === 'lg' ? 112 :
                    80;

  if (badge.imageUrl) {
    return (
      <div
        className="relative inline-block select-none"
        style={{ width: sizePx, height: sizePx }}
        title={badge.description}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={badge.imageUrl}
          alt={badge.label}
          width={sizePx}
          height={sizePx}
          className="w-full h-full object-contain"
          style={{
            transform: `rotate(${(badge.key.charCodeAt(0) % 7) - 3}deg)`,
          }}
        />
      </div>
    );
  }

  const sizeClass =
    size === 'sm' ? 'w-16 h-16 text-[8px]' :
    size === 'lg' ? 'w-28 h-28 text-xs' :
                    'w-20 h-20 text-[10px]';
  return (
    <div
      className={`${sizeClass} relative rounded-full border-2 border-madder/70 flex items-center justify-center text-center p-1 select-none`}
      title={badge.description}
      style={{
        transform: `rotate(${(badge.key.charCodeAt(0) % 7) - 3}deg)`,
        boxShadow: 'inset 0 0 0 1px rgba(180,60,60,0.15)',
        background: 'rgba(244, 239, 230, 0.5)',
      }}
    >
      <span className="font-display tracking-wider uppercase text-madder leading-tight">
        {badge.label}
      </span>
    </div>
  );
}

/**
 * Client-side BadgeRow that fetches the live badge catalog from /api/badges
 * so it can render AI-generated seal PNGs when the admin has generated them.
 * Accepts legacy string keys and the canonical public read-model badge objects.
 */
export function BadgeRow({
  badges,
  size = 'md',
  className = '',
}: {
  badges: BadgeInput[] | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [catalog, setCatalog] = useState<Record<string, BadgeRecord> | null>(null);
  const keys = useMemo(() => normalizeBadgeKeys(badges), [badges]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/badges', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return;
        if (d?.badges && Array.isArray(d.badges)) {
          const map: Record<string, BadgeRecord> = {};
          for (const b of d.badges) {
            const key = badgeKeyOf(b);
            if (key) map[key] = b;
          }
          setCatalog(map);
        } else {
          setCatalog({});
        }
      })
      .catch(() => !cancelled && setCatalog({}));
    return () => { cancelled = true; };
  }, []);

  if (keys.length === 0) return null;

  const valid: BadgeRecord[] = catalog
    ? keys.map(k => catalog[k] || BADGE_BY_KEY[k as BadgeKey]).filter((b): b is BadgeRecord => !!b)
    : validBadges(keys);

  if (valid.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {valid.map(b => <Badge key={b.key} badge={b} size={size} />)}
    </div>
  );
}

/** Tiny inline badge chip — for product cards where space is tight. */
export function BadgeChip({ badgeKey }: { badgeKey: string }) {
  const normalized = badgeKeyOf(badgeKey) || badgeKey;
  const valid = validBadges([normalized]);
  if (valid.length === 0) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 border border-madder/40 text-madder text-[10px] tracking-widest uppercase font-ui bg-ivory/80"
        title={normalized}
      >
        {normalized.replace(/_/g, ' ')}
      </span>
    );
  }
  const b = valid[0];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 border border-madder/40 text-madder text-[10px] tracking-widest uppercase font-ui bg-ivory/80"
      title={b.description}
    >
      {b.label}
    </span>
  );
}

/** Stack of small chips — accepts both legacy keys and canonical badge objects. */
export function BadgeChipRow({ badges }: { badges: BadgeInput[] | null | undefined }) {
  const keys = normalizeBadgeKeys(badges);
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {keys.slice(0, 2).map(k => <BadgeChip key={k} badgeKey={k} />)}
    </div>
  );
}
