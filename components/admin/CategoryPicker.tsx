'use client';

/**
 * CategoryPicker — searchable autocomplete that shows the full breadcrumb inline.
 *
 * Examples:
 *   typing "Banarasi" → "Women / Sarees / Banarasi"
 *                    → "Women / Dupattas & Stoles / Banarasi" (separate option)
 *
 * Features:
 *   - debounced search of /api/admin/taxonomy/search
 *   - "✨ Resolve with AI" button: if nothing matches, call the AI resolver with
 *     the product context to auto-pick (or auto-create) the right leaf.
 *   - emits { id, slug, path, label } via onChange.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export type CategoryPickerValue = {
  id: string;
  slug: string;
  path: string;
  label: string;
  level: number;
} | null;

export type CategoryPickerProps = {
  value: CategoryPickerValue;
  onChange: (v: CategoryPickerValue) => void;
  /** Product context — passed to AI resolver for better picks/creation. */
  productContext?: {
    name?: string;
    description?: string;
    craft?: string;
    region?: string;
    material?: string;
    tags?: string[];
  };
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Show "+ Create with AI" suggestion when no match. Default: true. */
  allowAiCreate?: boolean;
};

export default function CategoryPicker({
  value,
  onChange,
  productContext,
  placeholder = 'Search category (e.g. Banarasi, Floor Lamp, Attar)…',
  required,
  disabled,
  allowAiCreate = true,
}: CategoryPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/taxonomy/search?q=${encodeURIComponent(query)}&limit=25`,
          { cache: 'no-store' },
        );
        const json = await res.json();
        setRows(json.rows || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const display = useMemo(() => {
    if (value) return value.label;
    return '';
  }, [value]);

  async function resolveWithAi() {
    setAiBusy(true);
    setAiNote(null);
    try {
      const res = await fetch('/api/admin/taxonomy/ai-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          product: productContext,
          allowCreate: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setAiNote(json.error || 'AI could not resolve a category');
        return;
      }
      onChange({
        id: json.categoryId,
        slug: json.slug,
        path: json.path,
        label: json.breadcrumb?.map((b: any) => b.name).join(' / ') || json.name,
        level: json.level,
      });
      if (json.created?.length) {
        setAiNote(`AI created new category: ${json.created.join(', ')}`);
      } else {
        setAiNote(`Matched (${json.matchedBy})`);
      }
      setOpen(false);
    } catch (e: any) {
      setAiNote(e?.message || 'AI request failed');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      {/* Hidden input to satisfy required form validation */}
      {required && (
        <input
          type="text"
          tabIndex={-1}
          value={value?.id || ''}
          onChange={() => {}}
          required
          style={{
            position: 'absolute',
            opacity: 0,
            height: 1,
            width: 1,
            pointerEvents: 'none',
          }}
        />
      )}

      <div className="flex gap-2 items-stretch">
        <div className="flex-1 relative">
          <input
            type="text"
            value={open ? query : display}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={() => {
              setOpen(true);
              setQuery('');
            }}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-madder/40"
          />
          {value && !open && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setQuery('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs"
              aria-label="Clear"
            >
              ✕
            </button>
          )}
        </div>
        {allowAiCreate && (
          <button
            type="button"
            onClick={resolveWithAi}
            disabled={aiBusy || disabled}
            className="px-3 py-2 text-xs rounded-md border border-madder text-madder hover:bg-madder/5 disabled:opacity-40 whitespace-nowrap"
            title="Use AI to pick or create the right category from this product's details"
          >
            {aiBusy ? '…' : '✨ Resolve with AI'}
          </button>
        )}
      </div>

      {aiNote && (
        <div className="mt-1 text-[11px] text-zinc-500">{aiNote}</div>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full max-h-80 overflow-auto bg-white border border-zinc-200 rounded-md shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-zinc-400">Searching…</div>}
          {!loading && rows.length === 0 && (
            <div className="px-3 py-3 text-xs text-zinc-500">
              No match. Type more or click <strong>✨ Resolve with AI</strong> to auto-pick or create
              the right sub-category.
            </div>
          )}
          {rows.map((r) => (
            <button
              type="button"
              key={r.id}
              onClick={() => {
                onChange({
                  id: r.id,
                  slug: r.slug,
                  path: r.path,
                  label: r.label,
                  level: r.level,
                });
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-zinc-50 border-b border-zinc-100 last:border-0"
            >
              <div className="text-sm text-zinc-800">{r.label}</div>
              <div className="text-[11px] text-zinc-400 font-mono">
                {r.path} · L{r.level}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
