import Image from 'next/image';
import { NEEJEE_TAGLINE } from '@/lib/brand';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = {
  sm: 96,
  md: 132,
  lg: 190,
  xl: 280,
};

/**
 * Canonical NEEJEE brand lockup.
 *
 * BRAND LOCK: this component renders owner-supplied artwork only.
 * Typography, red centre dot, spacing, proportions and FOUND. PERSONAL.
 * are pixels from the approved master. Do not recreate the mark in HTML,
 * CSS, SVG paths or substitute fonts.
 */
export function NeejeeLogo({
  className = '',
  size = 'md',
}: Props) {
  const width = SIZE_MAP[size];
  const height = Math.round((width * 600) / 1550);

  return (
    <span
      className={className}
      role="img"
      aria-label={`NEEJEE — ${NEEJEE_TAGLINE}`}
      style={{
        display: 'inline-flex',
        width,
        height,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <Image
        src="/brand/neejee-lockup.png"
        alt=""
        aria-hidden="true"
        width={1550}
        height={600}
        priority={size === 'md'}
        unoptimized
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </span>
  );
}
