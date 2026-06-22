// The NEEJEE Select Authenticity stamp — used in cart, checkout, packaging.
// Hand-pressed thappa look, Madder Red ink on ivory.

type Props = {
  size?: number;
  className?: string;
};

export function AuthenticitySeal({ size = 100, className = '' }: Props) {
  const r = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={{ opacity: 0.85 }}
    >
      {/* Outer rough ring */}
      <circle
        cx="100" cy="100" r="92"
        fill="none"
        stroke="#8B2E2A"
        strokeWidth="2"
        strokeDasharray="2 1.5"
      />
      {/* Inner solid ring */}
      <circle cx="100" cy="100" r="80" fill="none" stroke="#8B2E2A" strokeWidth="1.5" />

      {/* Curved upper text — NEEJEE SELECT */}
      <defs>
        <path id="upperArc" d="M 30 100 A 70 70 0 0 1 170 100" />
        <path id="lowerArc" d="M 30 110 A 70 70 0 0 0 170 110" />
      </defs>
      <text fontFamily="Georgia, serif" fontSize="11" fill="#8B2E2A" letterSpacing="3" fontWeight="600">
        <textPath href="#upperArc" startOffset="50%" textAnchor="middle">
          NEEJEE&nbsp;·&nbsp;SELECT
        </textPath>
      </text>
      <text fontFamily="Georgia, serif" fontSize="9" fill="#8B2E2A" letterSpacing="2.5">
        <textPath href="#lowerArc" startOffset="50%" textAnchor="middle">
          AUTHENTIC&nbsp;·&nbsp;VERIFIED&nbsp;·&nbsp;CRAFT
        </textPath>
      </text>

      {/* Centre motif — "N" with bindi */}
      <text x="100" y="112" textAnchor="middle" fontFamily="Georgia, serif" fontSize="56" fontWeight="600" fill="#8B2E2A" letterSpacing="0">
        N
      </text>
      <circle cx="100" cy="78" r="5" fill="#8B2E2A" />

      {/* Decorative dots */}
      <circle cx="32" cy="100" r="2" fill="#8B2E2A" />
      <circle cx="168" cy="100" r="2" fill="#8B2E2A" />
    </svg>
  );
}
