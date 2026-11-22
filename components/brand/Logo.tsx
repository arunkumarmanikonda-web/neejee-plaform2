import Image from 'next/image';
import { NEEJEE_TAGLINE } from '@/lib/brand';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = { sm: 94, md: 172, lg: 190, xl: 260 };
const COMPACT_ASPECT = 390 / 91;
const FULL_ASPECT = 390 / 100;

/** Original Neejee lettering and folded-selvedge mark. */
export function NeejeeLogo({ className = '', size = 'md', variant = 'default', showTagline = false }: Props) {
  const width = SIZE_MAP[size];
  const aspect = showTagline ? FULL_ASPECT : COMPACT_ASPECT;
  const height = Math.round(width / aspect);
  const src = '/brand/identity/' + (showTagline ? 'lockup' : 'compact') + (variant === 'ivory' ? '-reverse' : '') + '.svg';

  return (
    <Image
      className={className}
      src={src}
      alt={showTagline ? `NEEJEE. ${NEEJEE_TAGLINE}` : 'NEEJEE'}
      width={width}
      height={height}
      draggable={false}
      priority={size === 'lg' || size === 'xl'}
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
