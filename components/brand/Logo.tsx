import { NEEJEE_TAGLINE } from '@/lib/brand';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = {
  sm: { width: 72, mark: 34, word: 18, tag: 5.5, gap: 4 },
  md: { width: 100, mark: 42, word: 24, tag: 7, gap: 5 },
  lg: { width: 160, mark: 68, word: 36, tag: 10, gap: 8 },
  xl: { width: 240, mark: 98, word: 52, tag: 13, gap: 10 },
};

const COLOR_MAP = {
  default: '#0B0B0B',
  ivory: '#F4EFE6',
  mono: '#0B0B0B',
};

/**
 * Canonical NEEJEE brand lockup.
 *
 * Approved identity revision: 2026-08-17-arch-lowercase.
 * Never reintroduce the legacy uppercase NEE • JEE / red-bindi mark.
 * Compact placements use the same arch + lowercase wordmark. Full brand
 * signature placements add the permanent line: FOUND. PERSONAL.
 */
export function NeejeeLogo({
  className = '',
  size = 'md',
  variant = 'default',
  showTagline = false,
}: Props) {
  const s = SIZE_MAP[size];
  const color = COLOR_MAP[variant];

  return (
    <div
      className={className}
      role="img"
      aria-label={`NEEJEE — ${NEEJEE_TAGLINE}`}
      style={{
        width: s.width,
        color,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 120 110"
        width={s.mark}
        height={Math.round((s.mark * 110) / 120)}
        focusable="false"
        style={{ display: 'block' }}
      >
        <path
          fill="currentColor"
          d="M10 105V57C10 27 32 5 60 5s50 22 50 52v48H84V61c0-14-11-26-24-26S36 47 36 61v44H10Z"
        />
      </svg>

      <span
        aria-hidden="true"
        style={{
          marginTop: s.gap,
          fontFamily: 'var(--font-ui), Inter, Helvetica Neue, Arial, sans-serif',
          fontSize: s.word,
          fontWeight: 300,
          letterSpacing: '0.16em',
          whiteSpace: 'nowrap',
          textTransform: 'lowercase',
        }}
      >
        neejee
      </span>

      {showTagline ? (
        <span
          aria-hidden="true"
          style={{
            marginTop: s.gap + 1,
            fontFamily: 'var(--font-ui), Inter, Helvetica Neue, Arial, sans-serif',
            fontSize: s.tag,
            fontWeight: 400,
            letterSpacing: '0.34em',
            whiteSpace: 'nowrap',
          }}
        >
          {NEEJEE_TAGLINE}
        </span>
      ) : null}
    </div>
  );
}
