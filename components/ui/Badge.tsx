'use client';
// Hand-stamped seal/badge in NEEJEE brand style.
// Renders a real PNG (AI-generated thappa seal) when available, otherwise
// falls back to a CSS-rendered madder circle so things still ship pre-AI.
import { useEffect, useState } from 'react';
import { validBadges, BADGE_BY_KEY, type BadgeMeta, type BadgeKey } from '@/lib/badges';

// Extended shape: BadgeMeta + optional AI-generated imageUrl
export interface BadgeRecord extends BadgeMeta {
  imageUrl?: string | null;
}

interface BadgeProps {
  badge: BadgeRecord;
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({ badge, size = 'md' }: BadgeProps) {
  const sizePx =
    size === 'sm' ? 64 :
    size === 'lg' ? 112 :
                    80;

  // If we have a real PNG seal, render it
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

  // Fallback: CSS-rendered seal
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
 * so it can render AI-generated seal PNGs (imageUrl) when the admin has
 * generated them. Falls back to the static catalog if the fetch fails.
 */
export function BadgeRow({
  badges,
  size = 'md',
  className = '',
}: {
  badges: string[] | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [catalog, setCatalog] = useState<Record<string, BadgeRecord> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/badges', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (cancelled) return;
        if (d?.badges && Array.isArray(d.badges)) {
          const map: Record<string, BadgeRecord> = {};
          for (const b of d.badges) map[b.key] = b;
          setCatalog(map);
        } else {
          setCatalog({});
        }
      })
      .catch(() => !cancelled && setCatalog({}));
    return () => { cancelled = true; };
  }, []);

  if (!badges || badges.length === 0) return null;

  // While catalog is loading, render static fallback (avoids layout shift)
  const valid: BadgeRecord[] = catalog
    ? badges.map(k => catalog[k] || BADGE_BY_KEY[k as BadgeKey]).filter((b): b is BadgeRecord => !!b)
    : validBadges(badges);

  if (valid.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {valid.map(b => <Badge key={b.key} badge={b} size={size} />)}
    </div>
  );
}

/** Tiny inline badge chip — for product cards where space is tight. */
export function BadgeChip({ badgeKey }: { badgeKey: string }) {
  const valid = validBadges([badgeKey]);
  if (valid.length === 0) {
    // Unknown key (e.g. custom DB badge) — render its key as label
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 border border-madder/40 text-madder text-[10px] tracking-widest uppercase font-ui bg-ivory/80"
        title={badgeKey}
      >
        {badgeKey.replace(/_/g, ' ')}
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

/** Stack of small chips — for product cards. */
export function BadgeChipRow({ badges }: { badges: string[] | null | undefined }) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.slice(0, 2).map(k => <BadgeChip key={k} badgeKey={k} />)}
    </div>
  );
}
