import { NEEJEE_TAGLINE } from '@/lib/brand';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = {
  sm: 72,
  md: 100,
  lg: 160,
  xl: 240,
};

// Owner-supplied NEEJEE primary artwork already stored in NEEJEE's production
// media bucket. The component crops that master image only. It never rebuilds,
// retypes, recolours or substitutes the logo.
const OFFICIAL_LOGO_MASTER =
  'https://xjqehwvxscoktfecbwse.supabase.co/storage/v1/object/public/neejee-media/legal-entity/1781352832764-ig1uzl-01_neejee_primary_logo.png';

const MASTER_WIDTH = 2048;
const MASTER_HEIGHT = 1152;
const CROP_LEFT = 250;
const CROP_TOP = 300;
const CROP_WIDTH = 1550;
const WORDMARK_HEIGHT = 360;
const LOCKUP_HEIGHT = 600;

/**
 * Canonical owner-supplied NEEJEE identity.
 *
 * Header/compact placements show the NEE · JEE wordmark crop from the master.
 * Full placements show the same master including FOUND. PERSONAL.
 * `variant` remains accepted for backwards compatibility but is intentionally
 * not used: official artwork colours must never be altered in application code.
 */
export function NeejeeLogo({
  className = '',
  size = 'md',
  variant: _variant = 'default',
  showTagline = false,
}: Props) {
  const width = SIZE_MAP[size];
  const cropHeight = showTagline ? LOCKUP_HEIGHT : WORDMARK_HEIGHT;
  const height = (width * cropHeight) / CROP_WIDTH;
  const masterRenderWidth = (width * MASTER_WIDTH) / CROP_WIDTH;
  const masterRenderHeight = (width * MASTER_HEIGHT) / CROP_WIDTH;
  const left = -(width * CROP_LEFT) / CROP_WIDTH;
  const top = -(width * CROP_TOP) / CROP_WIDTH;

  return (
    <span
      className={className}
      role="img"
      aria-label={`NEEJEE — ${NEEJEE_TAGLINE}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <img
        src={OFFICIAL_LOGO_MASTER}
        alt=""
        aria-hidden="true"
        decoding="async"
        draggable={false}
        style={{
          position: 'absolute',
          width: masterRenderWidth,
          height: masterRenderHeight,
          maxWidth: 'none',
          left,
          top,
          display: 'block',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      />
    </span>
  );
}
