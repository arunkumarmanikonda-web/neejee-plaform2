// v23.40.15 — Official NEEJEE brand mark for print/email.
// Pure SVG, no external dependencies — embeds cleanly in PDFs and emails.
//
// Renders the wordmark exactly as the brand book defines it:
//   • NEE • JEE in Playfair Display vintage serif, weight 600
//   • Madder Red bindi (#8B2E2A) as the dot between the two halves
//   • Optional "FOUND. PERSONAL." tagline in Inter caps with letter-spacing
//
// Why SVG inline rather than a /public PNG:
//   - Print routes serve themselves as raw HTML; a relative <img src> can fail
//   - SVG prints crisp at any resolution (PNGs blur at 1200 DPI print)
//   - Identity stays intact even if the user disables image loading

import * as React from 'react';

interface Props {
  width?: number;
  height?: number;
  variant?: 'kohl' | 'ivory';
  showTagline?: boolean;
}

export function NeejeeBrandMark({
  width = 220, height = 80, variant = 'kohl', showTagline = true,
}: Props) {
  const text   = variant === 'kohl'  ? '#1A1613' : '#F4EFE6';
  const bindi  = '#8B2E2A';
  const muted  = variant === 'kohl'  ? '#6B6862' : '#E8DFCF';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 440 160"
      width={width}
      height={height}
      role="img"
      aria-label="NEEJEE"
      style={{ display: 'block' }}
    >
      <defs>
        <style>{`
          .neejee-display {
            font-family: 'Playfair Display','PT Serif',Georgia,'Times New Roman',serif;
            font-weight: 600;
            font-style: normal;
          }
          .neejee-tagline {
            font-family: 'Inter','Helvetica Neue',Arial,sans-serif;
            font-weight: 500;
            letter-spacing: 0.45em;
          }
        `}</style>
      </defs>

      {/* NEE */}
      <text
        x="148"
        y="92"
        textAnchor="end"
        className="neejee-display"
        fill={text}
        fontSize="82"
        letterSpacing="6"
      >
        NEE
      </text>

      {/* bindi */}
      <circle cx="220" cy="68" r="11" fill={bindi} />

      {/* JEE */}
      <text
        x="292"
        y="92"
        textAnchor="start"
        className="neejee-display"
        fill={text}
        fontSize="82"
        letterSpacing="6"
      >
        JEE
      </text>

      {showTagline && (
        <text
          x="220"
          y="132"
          textAnchor="middle"
          className="neejee-tagline"
          fill={muted}
          fontSize="13"
        >
          FOUND &#183; PERSONAL
        </text>
      )}
    </svg>
  );
}
