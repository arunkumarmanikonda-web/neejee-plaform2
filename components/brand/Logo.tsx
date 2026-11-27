import { NEEJEE_TAGLINE } from '@/lib/brand';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = { sm: 94, md: 192, lg: 190, xl: 260 };
const COMPACT_ASPECT = 688 / 114;
const FULL_ASPECT = 688 / 163;

/** Neejee’s bindi wordmark. */
export function NeejeeLogo({ className = '', size = 'md', variant = 'default', showTagline = false }: Props) {
  const width = SIZE_MAP[size];
  const aspect = showTagline ? FULL_ASPECT : COMPACT_ASPECT;
  const height = Math.round(width / aspect);
  const file = '/brand/identity/' + (showTagline ? 'lockup' : 'compact') + (variant === 'ivory' ? '-reverse' : '') + '.svg?v=bindi';

  // The primary signature travels with the page, including saved and printed pages.
  const src = showTagline && variant === 'default' ? process.env.NEEJEE_SIGNATURE_SRC || file : file;

  return (
    <img
      className={className}
      src={src}
      alt={showTagline ? `NEEJEE. ${NEEJEE_TAGLINE}` : 'NEEJEE'}
      width={width}
      height={height}
      draggable={false}
      loading="eager"
      decoding="sync"
      style={{
        display: 'block',
        width,
        height: 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
        flexShrink: 0,
        userSelect: 'none',
      }}
    />
  );
}
