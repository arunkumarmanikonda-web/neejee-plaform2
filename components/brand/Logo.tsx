import { NEEJEE_TAGLINE } from '@/lib/brand';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = {
  sm: 88,
  md: 132,
  lg: 180,
  xl: 260,
};

const COMPACT_ASPECT = 1425 / 285;
const FULL_ASPECT = 1425 / 415;

/**
 * Canonical NEEJEE identity.
 *
 * These assets are traced directly from the owner-approved NEEJEE artwork.
 * Nothing is retyped, reconstructed, recoloured, stretched or manually cropped
 * at render time. Compact placements use the approved NEE · JEE wordmark;
 * full placements use the approved lockup with FOUND. PERSONAL.
 */
export function NeejeeLogo({
  className = '',
  size = 'md',
  variant = 'default',
  showTagline = false,
}: Props) {
  const width = SIZE_MAP[size];
  const aspect = showTagline ? FULL_ASPECT : COMPACT_ASPECT;
  const height = width / aspect;
  const src = showTagline
    ? '/brand/neejee-logo.svg'
    : '/brand/neejee-logo-compact.svg';

  return (
    <img
      className={className}
      src={src}
      alt={showTagline ? `NEEJEE — ${NEEJEE_TAGLINE}` : 'NEEJEE'}
      width={width}
      height={height}
      decoding="async"
      draggable={false}
      style={{
        display: 'block',
        width,
        height,
        maxWidth: '100%',
        objectFit: 'contain',
        flexShrink: 0,
        userSelect: 'none',
        backgroundColor: variant === 'ivory' ? '#F8F2E9' : undefined,
        padding: variant === 'ivory' ? '10px 12px' : undefined,
      }}
    />
  );
}
