'use client';
import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard } from '@/components/product/ProductCard';
import { Filter, X, ChevronDown } from 'lucide-react';
import { formatINR, paiseToRupees } from '@/lib/money';

export const dynamic = 'force-dynamic';

function PLPInner() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp?.toString() || '';
  const slug = params?.slug as string;

  const [products, setProducts] = useState<any[]>([]);
  const [facets, setFacets] = useState<any>({ crafts: [], regions: [], materials: [], occasions: [], badges: [], priceRange: { minPaise: 0, maxPaise: 0 } });
  const [category, setCategory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = useMemo(() => ({
    craft: sp?.get('craft') || '',
    region: sp?.get('region') || '',
    material: sp?.get('material') || '',
    occasion: sp?.get('occasion') || '',
    badge: sp?.get('badge') || '',
    minPrice: sp?.get('minPrice') || '',
    maxPrice: sp?.get('maxPrice') || '',
    sort: sp?.get('sort') || 'newest',
    q: sp?.get('q') || '',
  }), [spKey]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(sp?.toString() || '');
    if (value) next.set(key, value); else next.delete(key);
    router.push(`/categories/${slug}?${next.toString()}`);
  };

  const clearAll = () => router.push(`/categories/${slug}`);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const qs = new URLSearchParams();
      qs.set('category', slug);
      Object.entries(filters).forEach(([k, v]) => { if (v) qs.set(k, v as string); });

      setLoading(true);

      try {
        const [productsRes, facetsRes] = await Promise.all([
          fetch(`/api/products?${qs.toString()}`, { cache: 'no-store' }),
          fetch(`/api/facets?category=${encodeURIComponent(slug)}`, { cache: 'no-store' }),
        ]);

        const p = productsRes.ok
          ? await productsRes.json()
          : { products: [], error: `products ${productsRes.status}` };

        const f = facetsRes.ok
          ? await facetsRes.json()
          : {
              crafts: [],
              regions: [],
              materials: [],
              occasions: [],
              badges: [],
              priceRange: { minPaise: 0, maxPaise: 0 },
              error: `facets ${facetsRes.status}`
            };

        if (cancelled) return;

        setProducts(Array.isArray(p?.products) ? p.products : []);
        setFacets(
          f && typeof f === 'object'
            ? f
            : { crafts: [], regions: [], materials: [], occasions: [], badges: [], priceRange: { minPaise: 0, maxPaise: 0 } }
        );

        const matched = f?.matchedCategory || p?.matchedCategory;
        setCategory(matched || { name: slug.charAt(0).toUpperCase() + slug.slice(1) });
      } catch (e) {
        if (cancelled) return;
        setProducts([]);
        setFacets({ crafts: [], regions: [], materials: [], occasions: [], badges: [], priceRange: { minPaise: 0, maxPaise: 0 } });
        setCategory({ name: slug.charAt(0).toUpperCase() + slug.slice(1) });
        console.error('[PLP slug] load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug, filters]);

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== 'sort' && k !== 'q').length;

  return (
    <>
      <Header />

      {/* Editorial header */}
      <section className="max-w-8xl mx-auto px-6 lg:px-12 pt-10 pb-6">
        <Link href="/" className="label text-mitti hover:text-madder">← HOME</Link>
        <h1 className="font-display text-4xl lg:text-5xl text-kohl mt-2">
          {category?.name || slug?.toUpperCase()}
        </h1>
        <p className="font-italic italic text-mitti mt-2">
          {loading ? 'Loading...' : `${products.length} pieces · India's finest craft, curated by hand`}
        </p>
        <div className="madder-divider mt-4"></div>
      </section>

      {/* Sort + Filter toggle bar */}
      <section className="max-w-8xl mx-auto px-6 lg:px-12 sticky top-20 z-30 bg-ivory border-b border-beige py-4 flex items-center justify-between gap-4">
        <button onClick={() => setMobileFiltersOpen(true)} className="lg:hidden btn-outline text-xs flex items-center gap-2">
          <Filter className="w-4 h-4" /> FILTERS {activeFilters > 0 && `(${activeFilters})`}
        </button>
        <p className="hidden lg:block font-ui text-xs tracking-widest text-mitti">
          {activeFilters > 0 ? `${activeFilters} FILTER${activeFilters > 1 ? 'S' : ''} APPLIED` : 'ALL ITEMS'}
        </p>
        <div className="flex items-center gap-3">
          {activeFilters > 0 && (
            <button onClick={clearAll} className="font-ui text-xs text-madder hover:underline">CLEAR ALL</button>
          )}
          <div className="relative">
            <select value={filters.sort} onChange={e => setParam('sort', e.target.value)}
              className="appearance-none bg-beige px-4 py-2 pr-9 font-ui text-xs tracking-widest cursor-pointer">
              <option value="newest">NEWEST</option>
              <option value="price_asc">PRICE: LOW TO HIGH</option>
              <option value="price_desc">PRICE: HIGH TO LOW</option>
              <option value="name">NAME A-Z</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </section>

      <section className="max-w-8xl mx-auto px-6 lg:px-12 py-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-10">
        {/* DESKTOP FILTER RAIL */}
        <aside className="hidden lg:block">
          <FilterPanel facets={facets} filters={filters} setParam={setParam} />
        </aside>

        {/* MOBILE FILTER DRAWER */}
        {mobileFiltersOpen && (
          <div className="lg:hidden fixed inset-0 bg-kohl/60 z-50 flex items-end" onClick={() => setMobileFiltersOpen(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-ivory w-full max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl text-kohl">Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)}><X className="w-5 h-5" /></button>
              </div>
              <FilterPanel facets={facets} filters={filters} setParam={setParam} />
              <button onClick={() => setMobileFiltersOpen(false)} className="btn-primary w-full mt-6">
                APPLY FILTERS · {products.length}
              </button>
            </div>
          </div>
        )}

        {/* GRID */}
        <div>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-beige animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-display text-2xl text-kohl">Nothing matches yet.</p>
              <p className="font-italic italic text-mitti mt-2">Try removing some filters.</p>
              {activeFilters > 0 && (
                <button onClick={clearAll} className="btn-outline mt-6">CLEAR ALL FILTERS</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

function FilterPanel({ facets, filters, setParam }: any) {
  const minR = paiseToRupees(facets.priceRange?.minPaise || 0);
  const maxR = paiseToRupees(facets.priceRange?.maxPaise || 0);
  return (
    <div className="space-y-6 font-ui text-sm">
      <FilterGroup title="Craft" current={filters.craft} options={facets.crafts} onChange={(v: string) => setParam('craft', v)} />
      <FilterGroup title="Region" current={filters.region} options={facets.regions} onChange={(v: string) => setParam('region', v)} />
      <FilterGroup title="Material" current={filters.material} options={facets.materials} onChange={(v: string) => setParam('material', v)} />
      <FilterGroup title="Occasion" current={filters.occasion} options={facets.occasions} onChange={(v: string) => setParam('occasion', v)} />
      <FilterGroup title="Badges & Seals" current={filters.badge} options={facets.badges} onChange={(v: string) => setParam('badge', v)} />
      <div>
        <p className="label text-kohl mb-3">PRICE (₹)</p>
        <div className="flex gap-2 items-center">
          <input type="number" min="0" placeholder={String(minR || 0)}
            value={filters.minPrice} onChange={e => setParam('minPrice', e.target.value)}
            className="w-20 p-2 bg-beige border border-mitti/20 text-xs" />
          <span className="text-mitti">–</span>
          <input type="number" min="0" placeholder={String(maxR || 50000)}
            value={filters.maxPrice} onChange={e => setParam('maxPrice', e.target.value)}
            className="w-20 p-2 bg-beige border border-mitti/20 text-xs" />
        </div>
        {(minR || maxR) && (
          <p className="font-ui text-[10px] text-mitti mt-2">
            Range: {formatINR(facets.priceRange.minPaise)} – {formatINR(facets.priceRange.maxPaise)}
          </p>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, current, options, onChange }: any) {
  if (!options || options.length === 0) return null;
  return (
    <div>
      <p className="label text-kohl mb-3">{title.toUpperCase()}</p>
      <div className="space-y-1.5">
        {options.slice(0, 10).map(([name, count]: [string, number]) => (
          <button key={name} onClick={() => onChange(current === name ? '' : name)}
            className={`flex items-center justify-between w-full text-left text-xs py-1 ${current === name ? 'text-madder font-medium' : 'text-kohl hover:text-madder'}`}>
            <span>{name}</span>
            <span className="text-mitti">({count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PLPPage() {
  return (
    <Suspense fallback={<div className="p-12 text-mitti">Loading...</div>}>
      <PLPInner />
    </Suspense>
  );
}
