// Smart per-category variant suggestions.
// Used by the admin product editor to pre-fill the variant quick-add modal.

export interface SizeSuggestion {
  label: string;          // shown to the admin
  sizes: string[];        // the actual variant size strings created
  hint?: string;          // a small explanatory line
}

/**
 * Suggest a set of variant size presets based on the category slug or name.
 * Returns 1-3 preset options the admin can pick from, plus a "custom" fallback.
 */
export function suggestSizesForCategory(categorySlugOrName: string | null | undefined): SizeSuggestion[] {
  const s = (categorySlugOrName || '').toLowerCase();

  // Clothing categories
  if (/saree|sari|kurta|kurti|dupatta|lehenga|blouse|sherwani|shirt|dress|tunic|salwar|kameez|clothing|men|women/.test(s)) {
    return [
      {
        label: 'Standard run · XS to XXL',
        sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        hint: 'The full size run for most apparel.',
      },
      {
        label: 'Compact run · S to XL',
        sizes: ['S', 'M', 'L', 'XL'],
        hint: 'The core four sizes most artisans stock.',
      },
      {
        label: 'Free Size only',
        sizes: ['Free Size'],
        hint: 'A single one-size piece (sarees, dupattas).',
      },
    ];
  }

  // Jewellery
  if (/jewell?ery|earring|necklace|bangle|ring|jhumka|haar/.test(s)) {
    return [
      {
        label: 'One size',
        sizes: ['One Size'],
        hint: 'Default for most jewellery.',
      },
      {
        label: 'Ring sizes · 12 to 22',
        sizes: ['12', '14', '16', '18', '20', '22'],
        hint: 'Indian ring size run.',
      },
      {
        label: 'Bangle sizes · 2.4 to 2.10',
        sizes: ['2.4', '2.6', '2.8', '2.10'],
        hint: 'Standard Indian bangle sizing.',
      },
    ];
  }

  // Furniture / homewares / accessories
  if (/furniture|home|decor|vase|bowl|tray|sandook|lamp|sculpture|artefact|art-piece/.test(s)) {
    return [
      {
        label: 'Small / Medium / Large',
        sizes: ['Small', 'Medium', 'Large'],
        hint: 'Use this when the piece comes in three sizes.',
      },
      {
        label: 'Custom dimensions',
        sizes: ['Custom (L \u00d7 W \u00d7 H cm)'],
        hint: 'A single placeholder. Edit the size to the exact dimensions afterwards.',
      },
      {
        label: 'Single one-of-a-kind',
        sizes: ['One of one'],
        hint: 'Use for unique pieces with no variation.',
      },
    ];
  }

  // Fragrance / attar
  if (/fragrance|attar|ittar|perfume|oil/.test(s)) {
    return [
      {
        label: 'Bottle sizes · 5ml to 100ml',
        sizes: ['5ml', '10ml', '25ml', '50ml', '100ml'],
        hint: 'Standard attar/perfume sizes.',
      },
      {
        label: 'Compact run \u00b7 5ml + 25ml',
        sizes: ['5ml', '25ml'],
        hint: 'Tester + full-size.',
      },
    ];
  }

  // Scarves / stoles
  if (/scarf|stole|shawl|pashmina/.test(s)) {
    return [
      {
        label: 'Free Size',
        sizes: ['Free Size'],
        hint: 'Standard for scarves and stoles.',
      },
    ];
  }

  // Default \u2014 generic fallback for anything else
  return [
    {
      label: 'Standard apparel \u00b7 XS-XXL',
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      hint: 'If this piece is clothing.',
    },
    {
      label: 'One size',
      sizes: ['One Size'],
      hint: 'If this piece has no size variation.',
    },
    {
      label: 'Small / Medium / Large',
      sizes: ['Small', 'Medium', 'Large'],
      hint: 'If this piece has three discrete sizes.',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour palettes per category — used by the Add-Variants modal
// to offer one-click colour presets alongside sizes.

export interface ColorSuggestion {
  label: string;
  // Array of { name, hex }. hex is best-effort; admins can edit afterwards.
  colors: Array<{ name: string; hex: string }>;
  hint?: string;
}

export function suggestColorsForCategory(categorySlugOrName: string | null | undefined): ColorSuggestion[] {
  const key = (categorySlugOrName || '').toLowerCase();

  // Lamps / decor / lifestyle objects — soft sunset palette
  if (/lamp|light|decor|pottery|vase|ceramic|home/.test(key)) {
    return [
      {
        label: 'Sunset glass · 6 colours',
        colors: [
          { name: 'Sky Blue',  hex: '#7FB3D5' },
          { name: 'Amber',     hex: '#D49E3C' },
          { name: 'Rose',      hex: '#C5736A' },
          { name: 'Sage',      hex: '#8DA88E' },
          { name: 'Ivory',     hex: '#F4EFE6' },
          { name: 'Midnight',  hex: '#2C3E50' },
        ],
        hint: 'Common Turkish-mushroom-lamp glassware palette.',
      },
      {
        label: 'Earth · 4 colours',
        colors: [
          { name: 'Terracotta', hex: '#B7472A' },
          { name: 'Mitti',      hex: '#7A6B58' },
          { name: 'Khadi',      hex: '#E8DCC4' },
          { name: 'Kohl',       hex: '#1A1714' },
        ],
      },
    ];
  }

  // Sarees / kurtas / clothing — classic Indian wedding palette
  if (/saree|sari|kurta|lehenga|dupatta|fabric|apparel|clothing/.test(key)) {
    return [
      {
        label: 'Wedding palette · 6 colours',
        colors: [
          { name: 'Madder Red', hex: '#8B2E2A' },
          { name: 'Mehendi',    hex: '#5D7A2E' },
          { name: 'Haldi',      hex: '#D4A82C' },
          { name: 'Indigo',     hex: '#283891' },
          { name: 'Rose Pink',  hex: '#D87B92' },
          { name: 'Ivory',      hex: '#F4EFE6' },
        ],
      },
      {
        label: 'Pastels · 4 colours',
        colors: [
          { name: 'Mint',       hex: '#A8D8C9' },
          { name: 'Peach',      hex: '#F5C9A6' },
          { name: 'Lavender',   hex: '#C7B8E0' },
          { name: 'Powder Blue',hex: '#B8D3E0' },
        ],
      },
    ];
  }

  // Jewellery — metal finishes
  if (/jewel|bangle|kada|earring|necklace|ring|bracelet|kangan|cuff/.test(key)) {
    return [
      {
        label: 'Metal finish · 4 options',
        colors: [
          { name: 'Antique Gold', hex: '#B8923B' },
          { name: 'Polished Silver', hex: '#C0C0C0' },
          { name: 'Rose Gold', hex: '#B76E79' },
          { name: 'Oxidised',  hex: '#3F3F3F' },
        ],
      },
      {
        label: 'Stone accents · 4 colours',
        colors: [
          { name: 'Emerald', hex: '#0E6B47' },
          { name: 'Ruby',    hex: '#8B0F1A' },
          { name: 'Sapphire',hex: '#1F3A93' },
          { name: 'Pearl',   hex: '#F2EAD3' },
        ],
      },
    ];
  }

  // Default fallback — generic accent palette
  return [
    {
      label: 'Generic · 4 colours',
      colors: [
        { name: 'Ivory',     hex: '#F4EFE6' },
        { name: 'Kohl',      hex: '#1A1714' },
        { name: 'Madder',    hex: '#8B2E2A' },
        { name: 'Mitti',     hex: '#7A6B58' },
      ],
      hint: 'Edit colours after creation to match what you actually stock.',
    },
  ];
}
