import Image from 'next/image';
import { NEEJEE_TAGLINE } from '@/lib/brand';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = { sm: 88, md: 132, lg: 180, xl: 260 };
const COMPACT_ASPECT = 1425 / 285;
const FULL_ASPECT = 1425 / 415;

/** Canonical NEEJEE identity traced from the owner-approved artwork. */
export function NeejeeLogo({ className = '', size = 'md', variant = 'default', showTagline = false }: Props) {
  const width = SIZE_MAP[size];
  const aspect = showTagline ? FULL_ASPECT : COMPACT_ASPECT;
  const height = Math.round(width / aspect);
  const src = showTagline ? '/brand/neejee-logo.svg' : '/brand/neejee-logo-compact.svg';

  return (
    <Image
      className={className}
      src={src}
      alt={showTagline ? `NEEJEE — ${NEEJEE_TAGLINE}` : 'NEEJEE'}
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
        backgroundColor: variant === 'ivory' ? '#F8F2E9' : undefined,
        padding: variant === 'ivory' ? '10px 12px' : undefined,
      }}
    />
  );
}
