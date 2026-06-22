'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Product } from '@/lib/data';

type FilterGroup = {
  key: 'craft' | 'region' | 'material' | 'occasion' | 'priceRange';
  label: string;
  options: { label: string; count: number; value: string }[];
};

export type Filters = {
  craft: string[];
  region: string[];
  material: string[];
  occasion: string[];
  priceRange: string[];
};

const EMPTY_FILTERS: Filters = { craft: [], region: [], material: [], occasion: [], priceRange: [] };

export function FilterSidebar({
  products,
  filters,
  onChange,
}: {
  products: Product[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  // Build dynamic facets from the available products
  const facet = (key: keyof Product): Map<string, number> => {
    const m = new Map<string, number>();
    products.forEach(p => {
      const v = String(p[key] || '').split(' · ')[0].trim();
      if (v) m.set(v, (m.get(v) || 0) + 1);
    });
    return m;
  };

  const priceBuckets: { label: string; value: string; test: (paise: number) => boolean }[] = [
    { label: 'Under ₹5,000',         value: '0-500000',       test: p => p < 500000 },
    { label: '₹5,000 – ₹15,000',     value: '500000-1500000', test: p => p >= 500000 && p < 1500000 },
    { label: '₹15,000 – ₹50,000',    value: '1500000-5000000',test: p => p >= 1500000 && p < 5000000 },
    { label: '₹50,000 – ₹1L',        value: '5000000-10000000',test: p => p >= 5000000 && p < 10000000 },
    { label: 'Above ₹1L',            value: '10000000-',      test: p => p >= 10000000 },
  ];

  const groups: FilterGroup[] = [
    {
      key: 'craft', label: 'Craft',
      options: [...facet('craft')].map(([v, c]) => ({ label: v, count: c, value: v })),
    },
    {
      key: 'region', label: 'Region',
      options: [...facet('region')].map(([v, c]) => ({ label: v, count: c, value: v })),
    },
    {
      key: 'material', label: 'Material',
      options: [...facet('material')].slice(0, 8).map(([v, c]) => ({ label: v, count: c, value: v })),
    },
    {
      key: 'occasion', label: 'Occasion',
      options: [...facet('occasion')].slice(0, 6).map(([v, c]) => ({ label: v, count: c, value: v })),
    },
    {
      key: 'priceRange', label: 'Price',
      options: priceBuckets.map(b => ({
        label: b.label, value: b.value,
        count: products.filter(p => b.test(p.sellingPrice)).length,
      })).filter(o => o.count > 0),
    },
  ];

  const toggle = (groupKey: keyof Filters, value: string) => {
    const current = filters[groupKey];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onChange({ ...filters, [groupKey]: next });
  };

  const activeCount = Object.values(filters).reduce((s, arr) => s + arr.length, 0);

  return (
    <aside className="w-64 flex-shrink-0">
      <div className="flex items-baseline justify-between mb-6">
        <p className="label text-madder">FILTER {activeCount > 0 && `(${activeCount})`}</p>
        {activeCount > 0 && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="font-ui text-xs text-mitti hover:text-madder">
            CLEAR ALL
          </button>
        )}
      </div>

      {groups.map(g => (
        <FilterGroupBlock
          key={g.key}
          group={g}
          selected={filters[g.key]}
          onToggle={(v) => toggle(g.key, v)}
        />
      ))}
    </aside>
  );
}

function FilterGroupBlock({ group, selected, onToggle }: {
  group: FilterGroup; selected: string[]; onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-mitti/15 py-4">
      <button onClick={() => setOpen(!open)} className="w-full flex justify-between items-center font-ui text-xs tracking-widest text-kohl">
        <span>{group.label.toUpperCase()}</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="mt-3 space-y-2 max-h-56 overflow-y-auto">
          {group.options.map(o => (
            <label key={o.value} className="flex items-center justify-between cursor-pointer group">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => onToggle(o.value)}
                  className="accent-madder w-3.5 h-3.5"
                />
                <span className="font-body text-sm text-kohl group-hover:text-madder transition-colors">{o.label}</span>
              </span>
              <span className="font-ui text-[10px] text-monsoon">({o.count})</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper — apply filters to a product list
export function applyFilters(products: Product[], filters: Filters): Product[] {
  return products.filter(p => {
    if (filters.craft.length && !filters.craft.some(v => p.craft.includes(v))) return false;
    if (filters.region.length && !filters.region.some(v => p.region.includes(v))) return false;
    if (filters.material.length && !filters.material.some(v => p.material.includes(v))) return false;
    if (filters.occasion.length && !filters.occasion.some(v => p.occasion.includes(v))) return false;
    if (filters.priceRange.length) {
      const matches = filters.priceRange.some(range => {
        const [min, max] = range.split('-').map(n => n ? parseInt(n) : Infinity);
        return p.sellingPrice >= min && p.sellingPrice <= (max || Infinity);
      });
      if (!matches) return false;
    }
    return true;
  });
}
