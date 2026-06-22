'use client';
// v23.40.23 — Link-target picker for banners.
// Lets the editor choose a specific Product / Category / Collection / Drop / CMS page
// to point the banner at, instead of typing a free-text URL.

import { useEffect, useState, useMemo } from 'react';
import { Search, X, Tag, Package, FolderTree, Sparkles, FileText, Link2 } from 'lucide-react';

export type LinkType = 'url' | 'product' | 'category' | 'collection' | 'drop' | 'page';

export interface LinkValue {
  linkType?: LinkType | null;
  linkProductId?: string | null;
  linkCategoryId?: string | null;
  linkCollectionTag?: string | null;
  linkDropSlug?: string | null;
  linkPageSlug?: string | null;
  ctaUrl?: string | null;
}

interface Props {
  value: LinkValue;
  onChange: (v: LinkValue) => void;
}

const TYPES: { v: LinkType; l: string; icon: any; desc: string }[] = [
  { v: 'product',    l: 'Specific product',  icon: Package,    desc: 'Promote one product (PDP)' },
  { v: 'category',   l: 'Category',          icon: FolderTree, desc: 'A whole category page' },
  { v: 'collection', l: 'Collection / Badge',icon: Sparkles,   desc: 'All products with a badge (e.g. FOUNDER\u2019S EDIT)' },
  { v: 'drop',       l: 'Drop',              icon: Tag,        desc: 'A limited drop landing page' },
  { v: 'page',       l: 'CMS page',          icon: FileText,   desc: 'A custom /p/<slug> page' },
  { v: 'url',        l: 'Custom URL',        icon: Link2,      desc: 'Anything else (e.g. external link)' },
];

// Known collection badges (kept in sync with seed badges). Editor can also type any badge.
const KNOWN_COLLECTIONS = [
  "FOUNDER'S EDIT",
  'NEEJEE SELECT',
  'ARTISAN MADE',
  'AUTHENTICITY GUARANTEED',
  'SLOW MADE',
  'HANDLOOM CERTIFIED',
  'GI TAG',
];

export function BannerLinkPicker({ value, onChange }: Props) {
  const linkType: LinkType = (value.linkType as LinkType) || 'url';

  return (
    <div className="space-y-3">
      <div>
        <label className="label text-mitti mb-1.5 block">LINK BANNER TO</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {TYPES.map(t => {
            const Icon = t.icon;
            const active = linkType === t.v;
            return (
              <button
                key={t.v}
                type="button"
                onClick={() => onChange({ ...value, linkType: t.v })}
                className={`text-left p-2.5 border transition-colors ${
                  active ? 'border-kohl bg-beige/60' : 'border-mitti/20 hover:border-kohl/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-madder" />
                  <p className="font-display text-sm text-kohl">{t.l}</p>
                </div>
                <p className="text-[11px] text-mitti mt-1 leading-snug">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {linkType === 'product'    && <ProductPicker value={value} onChange={onChange} />}
      {linkType === 'category'   && <CategoryPicker value={value} onChange={onChange} />}
      {linkType === 'collection' && <CollectionPicker value={value} onChange={onChange} />}
      {linkType === 'drop'       && <DropPicker value={value} onChange={onChange} />}
      {linkType === 'page'       && <PagePicker value={value} onChange={onChange} />}
      {linkType === 'url'        && (
        <div>
          <label className="label text-mitti">CUSTOM URL</label>
          <input
            type="text"
            value={value.ctaUrl || ''}
            onChange={e => onChange({ ...value, ctaUrl: e.target.value })}
            placeholder="/products or https://..."
            className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui text-sm"
          />
        </div>
      )}
    </div>
  );
}

// ───────────────────── Product ─────────────────────
function ProductPicker({ value, onChange }: Props) {
  const [q, setQ] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  // Load currently-selected product info on mount
  useEffect(() => {
    if (value.linkProductId && !selected) {
      fetch(`/api/admin/products/${value.linkProductId}`)
        .then(r => r.json())
        .then(d => d.product && setSelected(d.product))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.linkProductId]);

  useEffect(() => {
    if (!q.trim()) { setProducts([]); return; }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/products?status=ACTIVE`)
        .then(r => r.json())
        .then(d => {
          const all = d.products || [];
          const ql = q.toLowerCase();
          setProducts(all.filter((p: any) =>
            p.name?.toLowerCase().includes(ql) || p.sku?.toLowerCase().includes(ql)
          ).slice(0, 12));
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-2">
      <label className="label text-mitti">SELECT PRODUCT</label>
      {selected ? (
        <div className="bg-beige/60 border border-mitti/20 p-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {selected.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.image || selected.images?.[0]} alt="" className="w-12 h-12 object-cover" />
            )}
            <div className="min-w-0">
              <p className="font-display text-sm text-kohl truncate">{selected.name}</p>
              <p className="text-xs text-mitti font-mono">{selected.sku} · /{selected.slug}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setSelected(null); onChange({ ...value, linkProductId: null }); }}
            className="text-madder hover:text-kohl"
            title="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mitti" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full pl-10 pr-3 py-2.5 bg-beige border border-mitti/20 text-sm"
            />
          </div>
          {loading && <p className="text-xs text-mitti">Searching…</p>}
          {!loading && products.length > 0 && (
            <div className="border border-mitti/20 max-h-64 overflow-y-auto bg-ivory">
              {products.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(p);
                    onChange({ ...value, linkProductId: p.id });
                    setQ('');
                    setProducts([]);
                  }}
                  className="w-full text-left p-2.5 border-b border-mitti/10 hover:bg-beige/50 flex items-center gap-3"
                >
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="w-10 h-10 object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm text-kohl truncate">{p.name}</p>
                    <p className="text-[11px] text-mitti font-mono">{p.sku}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ───────────────────── Category ─────────────────────
function CategoryPicker({ value, onChange }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => setCategories(d.categories || []))
      .catch(() => {});
  }, []);
  return (
    <div>
      <label className="label text-mitti">SELECT CATEGORY</label>
      <select
        value={value.linkCategoryId || ''}
        onChange={e => onChange({ ...value, linkCategoryId: e.target.value || null })}
        className="w-full mt-1 p-3 bg-beige border border-mitti/20 text-sm"
      >
        <option value="">— pick a category —</option>
        {categories.map((c: any) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

// ───────────────────── Collection / Badge ─────────────────────
function CollectionPicker({ value, onChange }: Props) {
  const [badges, setBadges] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/badges')
      .then(r => r.json())
      .then(d => {
        const list = (d.badges || []).map((b: any) => b.label).filter(Boolean);
        setBadges(Array.from(new Set([...KNOWN_COLLECTIONS, ...list])));
      })
      .catch(() => setBadges(KNOWN_COLLECTIONS));
  }, []);
  return (
    <div>
      <label className="label text-mitti">SELECT COLLECTION / BADGE</label>
      <select
        value={value.linkCollectionTag || ''}
        onChange={e => onChange({ ...value, linkCollectionTag: e.target.value || null })}
        className="w-full mt-1 p-3 bg-beige border border-mitti/20 text-sm"
      >
        <option value="">— pick a collection —</option>
        {badges.map(b => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
      <p className="text-[11px] text-mitti mt-1">
        Sends shoppers to <code>/products?badge={value.linkCollectionTag || '...'}</code> showing all products carrying this badge.
      </p>
    </div>
  );
}

// ───────────────────── Drop ─────────────────────
function DropPicker({ value, onChange }: Props) {
  const [drops, setDrops] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/drops')
      .then(r => r.json())
      .then(d => setDrops(d.drops || []))
      .catch(() => setDrops([]));
  }, []);
  return (
    <div>
      <label className="label text-mitti">SELECT DROP</label>
      <select
        value={value.linkDropSlug || ''}
        onChange={e => onChange({ ...value, linkDropSlug: e.target.value || null })}
        className="w-full mt-1 p-3 bg-beige border border-mitti/20 text-sm"
      >
        <option value="">— pick a drop —</option>
        {drops.map((d: any) => (
          <option key={d.id} value={d.slug}>{d.name} ({d.status})</option>
        ))}
      </select>
    </div>
  );
}

// ───────────────────── CMS Page ─────────────────────
function PagePicker({ value, onChange }: Props) {
  const [pages, setPages] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/cms')
      .then(r => r.json())
      .then(d => setPages((d.pages || []).filter((p: any) => p.status === 'PUBLISHED')))
      .catch(() => setPages([]));
  }, []);
  return (
    <div>
      <label className="label text-mitti">SELECT CMS PAGE</label>
      <select
        value={value.linkPageSlug || ''}
        onChange={e => onChange({ ...value, linkPageSlug: e.target.value || null })}
        className="w-full mt-1 p-3 bg-beige border border-mitti/20 text-sm"
      >
        <option value="">— pick a published page —</option>
        {pages.map((p: any) => (
          <option key={p.id} value={p.slug}>{p.title} (/p/{p.slug})</option>
        ))}
      </select>
    </div>
  );
}
