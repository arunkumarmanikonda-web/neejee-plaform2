'use client';
import { useState } from 'react';

const PALETTE: Record<string, string> = {
  'Antique Gold':    '#A47E3B',
  'Mitti Brown':     '#6B4423',
  'Madder Red':      '#8B2E2A',
  'Ajrakh Indigo':   '#1F3A5F',
  'Phulkari Pink':   '#C44569',
  'Sandalwood':      '#C9A87C',
  'Ivory Cream':     '#F4EFE6',
  'Neem Green':      '#5A6F3F',
  'Haldi Yellow':    '#D4A02A',
  'Kohl Black':      '#1A1613',
};

type Props = {
  colors?: string[];
  defaultColor?: string;
  onChange?: (color: string) => void;
};

export function SwatchPicker({ colors, defaultColor, onChange }: Props) {
  // Auto-pick 4 colors that fit the craft, or use provided
  const palette = colors && colors.length ? colors : ['Antique Gold', 'Madder Red', 'Mitti Brown', 'Sandalwood'];
  const [selected, setSelected] = useState(defaultColor || palette[0]);

  const handle = (c: string) => {
    setSelected(c);
    onChange?.(c);
  };

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="label text-mitti">COLOUR</span>
        <span className="font-display italic text-kohl text-sm">{selected}</span>
      </div>
      <div className="flex gap-2">
        {palette.map(c => {
          const hex = PALETTE[c] || '#A47E3B';
          return (
            <button
              key={c}
              onClick={() => handle(c)}
              title={c}
              className={`w-9 h-9 rounded-full transition-all ${selected === c ? 'ring-2 ring-offset-2 ring-madder' : 'ring-1 ring-mitti/20'}`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
