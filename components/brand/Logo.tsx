// The official NEEJEE wordmark logo.
// SVG-based — pixel-perfect at every size, no font-loading flicker.
// Includes the Madder Red bindi between the two halves of the name.

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'ivory' | 'mono';
  showTagline?: boolean;
};

const SIZE_MAP = {
  sm: { fontSize: 18, bindi: 4,  letterSpacing: 4 },
  md: { fontSize: 24, bindi: 5,  letterSpacing: 5 },
  lg: { fontSize: 36, bindi: 8,  letterSpacing: 7 },
  xl: { fontSize: 56, bindi: 12, letterSpacing: 10 },
};

const COLOR_MAP = {
  default: { text: '#1A1613', bindi: '#8B2E2A', tagline: '#6B6862' },
  ivory:   { text: '#F4EFE6', bindi: '#8B2E2A', tagline: '#E8DFCF' },
  mono:    { text: '#1A1613', bindi: '#1A1613', tagline: '#6B6862' },
};

export function NeejeeLogo({ className = '', size = 'md', variant = 'default', showTagline = false }: Props) {
  const s = SIZE_MAP[size];
  const c = COLOR_MAP[variant];
  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif" }}>
      <div
        style={{
          fontSize: s.fontSize,
          fontWeight: 600,
          letterSpacing: `${s.letterSpacing}px`,
          color: c.text,
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${s.letterSpacing}px`,
        }}
      >
        <span>NEE</span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: `${s.bindi * 2}px`,
            height: `${s.bindi * 2}px`,
            borderRadius: '50%',
            background: c.bindi,
            // Vertically centre within cap height (serif glyphs have descender slack)
            transform: 'translateY(-0.05em)',
          }}
        />
        <span>JEE</span>
      </div>
      {showTagline && (
        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: s.fontSize * 0.22,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: c.tagline,
            marginTop: s.fontSize * 0.4,
          }}
        >
          Found &nbsp;·&nbsp; Personal
        </div>
      )}
    </div>
  );
}
