'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/product/ProductCard';
import { Filter, X, ChevronDown } from 'lucide-react';

export const dynamic = 'force-dynamic';

function PLPInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [products, setProducts] = useState<any[]>([]);
  const [facets, setFacets] = useState<any>({
    crafts: [], regions: [], materials: [], occasions: [],
    priceRange: { minPaise: 0, maxPaise: 0 }, total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = useMemo(() => ({
    craft: sp?.get('craft') || '',
    region: sp?.get('region') || '',
    material: sp?.get('material') || '',
    occasion: sp?.get('occasion') || '',
    minPrice: sp?.get('minPrice') || '',
    maxPrice: sp?.get('maxPrice') || '',
    sort: sp?.get('sort') || 'newest',
    q: sp?.get('q') || '',
    featured: sp?.get('featured') || '',
  }), [sp]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp?.toString() || '');
    if (value) next.set(key, value); else next.delete(key);
    router.push(`/products?${next.toString()}`);
  };

  const clearAll = () => router.push(`/products`);

  useEffect(() => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v as string); });
    setLoading(true);
    Promise.all([
      fetch(`/api/products?${qs.toString()}&limit=60`).then(r => r.json()).catch(() => ({ products: [] })),
      fetch(`/api/facets`).then(r => r.json()).catch(() => ({})),
    ]).then(([list, fac]) => {
      setProducts(list.products || []);
      setFacets({
        crafts: fac.crafts || [],
        regions: fac.regions || [],
        materials: fac.materials || [],
        occasions: fac.occasions || [],
        priceRange: fac.priceRange || { minPaise: 0, maxPaise: 0 },
        total: fac.total || 0,
      });
      setLoading(false);
    });
  }, [filters]);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && k !== 'sort').length;

  return (
    <div className="min-h-screen bg-ivory">
      <Header />

      {/* Hero band */}
      <section className="bg-kohl text-ivory py-12 md:py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-banarasi mb-3">
            {filters.featured === 'founder' ? "FOUNDER'S EDIT" :
             filters.featured === 'sale' ? 'ON SALE' :
             filters.featured === 'new' ? 'NEW ARRIVALS' : 'THE COLLECTION'}
          </p>
          <h1 className="font-display text-4xl md:text-6xl mb-3">
            {filters.featured === 'founder' ? "Founder's Edit" :
             filters.featured === 'sale' ? 'On Sale' :
             filters.featured === 'new' ? 'New Arrivals' :
             filters.q ? `Search: ${filters.q}` : 'All Crafts'}
          </h1>
          <p className="text-ivory/70 max-w-2xl">
            Hand-curated artefacts from master craftspeople across India. Each piece carries its story.
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <div className="border-b border-kohl/10 bg-ivory sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="md:hidden flex items-center gap-2 text-sm tracking-wider"
          >
            <Filter className="w-4 h-4" /> FILTERS {activeFilterCount > 0 && <span className="bg-madder text-ivory px-2 rounded-full text-xs">{activeFilterCount}</span>}
          </button>
          <p className="text-xs tracking-wider text-kohl/60 hidden md:block">
            {loading ? 'Loading…' : `${products.length} of ${facets.total} pieces`}
          </p>
          <div className="flex items-center gap-3">
            <label className="text-xs tracking-wider text-kohl/60 hidden md:inline">SORT</label>
            <select
              value={filters.sort}
              onChange={(e) => setParam('sort', e.target.value)}
              className="border border-kohl/20 px-3 py-1.5 text-sm bg-ivory focus:outline-none focus:border-kohl"
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-[260px_1fr] gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <FilterPanel facets={facets} filters={filters} setParam={setParam} clearAll={clearAll} activeCount={activeFilterCount} />
        </aside>

        {/* Mobile drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 bg-kohl/40 md:hidden" onClick={() => setMobileFiltersOpen(false)}>
            <div className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-ivory p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-2xl">Filters</h3>
                <button onClick={() => setMobileFiltersOpen(false)}><X className="w-5 h-5" /></button>
              </div>
              <FilterPanel facets={facets} filters={filters} setParam={setParam} clearAll={clearAll} activeCount={activeFilterCount} />
            </div>
          </div>
        )}

        {/* Product grid */}
        <div>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-kohl/5 animate-pulse rounded" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-display text-3xl mb-3">Nothing here yet</p>
              <p className="text-kohl/60 mb-6">Try clearing filters or searching another craft.</p>
              <button onClick={clearAll} className="px-6 py-3 bg-kohl text-ivory text-sm tracking-wider hover:bg-kohl/90">CLEAR FILTERS</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {products.map((p: any) => (
                <ProductCard key={p.id} product={p as any} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

function FilterPanel({ facets, filters, setParam, clearAll, activeCount }: any) {
  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-[0.2em] text-kohl/60">REFINE</p>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs underline text-madder">Clear all</button>
        )}
      </div>

      <FacetGroup label="Craft" items={facets.crafts} active={filters.craft} onChange={(v: string) => setParam('craft', v)} />
      <FacetGroup label="Region" items={facets.regions} active={filters.region} onChange={(v: string) => setParam('region', v)} />
      <FacetGroup label="Material" items={facets.materials} active={filters.material} onChange={(v: string) => setParam('material', v)} />
      <FacetGroup label="Occasion" items={facets.occasions} active={filters.occasion} onChange={(v: string) => setParam('occasion', v)} />

      <div>
        <p className="text-xs tracking-[0.2em] text-kohl/60 mb-3">PRICE (₹)</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            defaultValue={filters.minPrice}
            onBlur={(e) => setParam('minPrice', e.target.value)}
            className="w-full border border-kohl/20 px-3 py-2 bg-ivory text-sm"
          />
          <span className="text-kohl/40">–</span>
          <input
            type="number"
            placeholder="Max"
            defaultValue={filters.maxPrice}
            onBlur={(e) => setParam('maxPrice', e.target.value)}
            className="w-full border border-kohl/20 px-3 py-2 bg-ivory text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function FacetGroup({ label, items, active, onChange }: any) {
  const [open, setOpen] = useState(true);
  if (!items || items.length === 0) return null;
  return (
    <div className="border-t border-kohl/10 pt-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between mb-3">
        <span className="text-xs tracking-[0.2em] text-kohl/60">{label.toUpperCase()}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {items.map(([name, count]: [string, number]) => (
            <label key={name} className="flex items-center justify-between cursor-pointer hover:text-madder">
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={active === name}
                  onChange={() => onChange(active === name ? '' : name)}
                  className="accent-madder"
                />
                <span>{name}</span>
              </span>
              <span className="text-xs text-kohl/40">{count}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ivory" />}>
      <PLPInner />
    </Suspense>
  );
}
