'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Filter, SlidersHorizontal, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ProductCard, type ProductCardData } from '@/components/product/ProductCard';
import { formatINR, paiseToRupees } from '@/lib/money';

export const dynamic = 'force-dynamic';

type FacetTuple = [string, number];
type CategorySummary = {
  id?: string;
  name?: string;
  slug?: string;
  path?: string | null;
  level?: number | null;
  breadcrumb?: string[];
  breadcrumbSlugs?: string[];
};
type RedirectResponse = { found?: boolean; toSlug?: string; permanent?: boolean };
type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};
type ProductsResponse = {
  ok?: boolean;
  matchedCategory?: CategorySummary | null;
  products?: any[];
  pagination?: Partial<PaginationState>;
};
type FacetsResponse = {
  ok?: boolean;
  matchedCategory?: CategorySummary | null;
  crafts?: FacetTuple[];
  regions?: FacetTuple[];
  materials?: FacetTuple[];
  occasions?: FacetTuple[];
  badges?: FacetTuple[];
  priceRange?: { minPaise?: number; maxPaise?: number };
  total?: number;
};
type FacetsState = {
  crafts: FacetTuple[];
  regions: FacetTuple[];
  materials: FacetTuple[];
  occasions: FacetTuple[];
  badges: FacetTuple[];
  priceRange: { minPaise: number; maxPaise: number };
  total: number;
};

const EMPTY_PAGINATION: PaginationState = {
  page: 1,
  limit: 24,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

function titleFromSlug(value: string) {
  return value.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function pathToBreadcrumbs(path: string | null | undefined) {
  if (!path) return { breadcrumb: undefined, breadcrumbSlugs: undefined };
  const breadcrumbSlugs = path.split('/').map((part) => part.trim()).filter(Boolean);
  if (!breadcrumbSlugs.length) return { breadcrumb: undefined, breadcrumbSlugs: undefined };
  return { breadcrumb: breadcrumbSlugs.map(titleFromSlug), breadcrumbSlugs };
}

function asCategoryFallback(slug: string): CategorySummary {
  return { name: titleFromSlug(slug), slug, path: slug, breadcrumb: [titleFromSlug(slug)], breadcrumbSlugs: [slug] };
}

function normalizeCategory(summary: CategorySummary | null | undefined, fallbackSlug: string): CategorySummary {
  if (!summary) return asCategoryFallback(fallbackSlug);
  const derived = pathToBreadcrumbs(summary.path);
  return {
    ...summary,
    name: summary.name || titleFromSlug(summary.slug || fallbackSlug),
    slug: summary.slug || fallbackSlug,
    breadcrumb: Array.isArray(summary.breadcrumb) && summary.breadcrumb.length ? summary.breadcrumb : derived.breadcrumb || [titleFromSlug(summary.slug || fallbackSlug)],
    breadcrumbSlugs: Array.isArray(summary.breadcrumbSlugs) && summary.breadcrumbSlugs.length ? summary.breadcrumbSlugs : derived.breadcrumbSlugs || [summary.slug || fallbackSlug],
  };
}

function normalizeFacetOptions(options: unknown): FacetTuple[] {
  if (!Array.isArray(options)) return [];
  return options.filter((item): item is FacetTuple => Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'number');
}

function asPage(value: string | null) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function mapProductToCardData(product: any): ProductCardData {
  const images = Array.isArray(product?.images)
    ? product.images.filter((img: unknown): img is string => typeof img === 'string' && img.trim().length > 0)
    : typeof product?.primaryImage === 'string' && product.primaryImage.trim().length > 0
      ? [product.primaryImage]
      : [];
  return {
    id: String(product?.id ?? ''),
    slug: String(product?.slug ?? ''),
    name: String(product?.name ?? 'Untitled Product'),
    poeticLine: typeof product?.poeticLine === 'string' ? product.poeticLine : null,
    craft: typeof product?.craft === 'string' ? product.craft : null,
    region: typeof product?.region === 'string' ? product.region : null,
    mrp: typeof product?.mrp === 'number' ? product.mrp : 0,
    sellingPrice: typeof product?.sellingPrice === 'number' ? product.sellingPrice : 0,
    salePrice: typeof product?.salePrice === 'number' ? product.salePrice : null,
    saleStartsAt: product?.saleStartsAt ?? null,
    saleEndsAt: product?.saleEndsAt ?? null,
    images,
    badges: Array.isArray(product?.badges) ? product.badges.filter((badge: unknown): badge is string => typeof badge === 'string' && badge.trim().length > 0) : [],
    inventory: typeof product?.inventory === 'number' ? product.inventory : undefined,
    aiTryOnEligible: !!product?.aiTryOnEligible,
  };
}

function emptyFacets(): FacetsState {
  return { crafts: [], regions: [], materials: [], occasions: [], badges: [], priceRange: { minPaise: 0, maxPaise: 0 }, total: 0 };
}

function PLPInner() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp?.toString() || '';
  const slug = String(params?.slug || '').trim();

  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [facets, setFacets] = useState<FacetsState>(emptyFacets());
  const [pagination, setPagination] = useState<PaginationState>(EMPTY_PAGINATION);
  const [category, setCategory] = useState<CategorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = useMemo(() => {
    const query = new URLSearchParams(spKey);
    return {
      craft: query.get('craft') || '',
      region: query.get('region') || '',
      material: query.get('material') || '',
      occasion: query.get('occasion') || '',
      badge: query.get('badge') || '',
      minPrice: query.get('minPrice') || '',
      maxPrice: query.get('maxPrice') || '',
      sort: query.get('sort') || 'newest',
      q: query.get('q') || '',
      page: asPage(query.get('page')),
    };
  }, [spKey]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(spKey);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'page') next.delete('page');
    if (key === 'page' && value === '1') next.delete('page');
    const qs = next.toString();
    router.push(qs ? `/categories/${slug}?${qs}` : `/categories/${slug}`);
  };

  const clearAll = () => router.push(`/categories/${slug}`);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug) {
        setProducts([]);
        setFacets(emptyFacets());
        setPagination(EMPTY_PAGINATION);
        setCategory(null);
        setLoading(false);
        return;
      }
      setLoading(true);

      try {
        const redirectRes = await fetch(`/api/categories/redirect?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
        if (redirectRes.ok) {
          const redirectData: RedirectResponse = await redirectRes.json();
          if (redirectData?.found && redirectData?.toSlug && redirectData.toSlug !== slug) {
            router.replace(`/categories/${redirectData.toSlug}`);
            return;
          }
        }

        const productsQs = new URLSearchParams({ category: slug });
        const facetsQs = new URLSearchParams({ category: slug });
        Object.entries(filters).forEach(([key, rawValue]) => {
          const value = String(rawValue ?? '');
          if (!value) return;
          if (key === 'page') {
            if (filters.page > 1) productsQs.set('page', String(filters.page));
            return;
          }
          productsQs.set(key, value);
          if (key !== 'sort') facetsQs.set(key, value);
        });

        const [productsResult, facetsResult] = await Promise.allSettled([
          fetch(`/api/products?${productsQs.toString()}`),
          fetch(`/api/facets?${facetsQs.toString()}`),
        ]);
        if (cancelled) return;

        let productsData: ProductsResponse = { products: [] };
        let facetsData: FacetsResponse = { total: 0 };
        if (productsResult.status === 'fulfilled' && productsResult.value.ok) productsData = await productsResult.value.json();
        if (facetsResult.status === 'fulfilled' && facetsResult.value.ok) facetsData = await facetsResult.value.json();

        const nextProducts = Array.isArray(productsData.products)
          ? productsData.products.map(mapProductToCardData).filter((product) => product.id && product.slug)
          : [];
        setProducts(nextProducts);

        const apiPagination = productsData.pagination || {};
        const total = typeof apiPagination.total === 'number' ? apiPagination.total : typeof facetsData.total === 'number' ? facetsData.total : nextProducts.length;
        const totalPages = typeof apiPagination.totalPages === 'number' && apiPagination.totalPages > 0 ? apiPagination.totalPages : Math.max(1, Math.ceil(total / 24));
        const currentPage = typeof apiPagination.page === 'number' && apiPagination.page > 0 ? apiPagination.page : filters.page;
        setPagination({
          page: currentPage,
          limit: typeof apiPagination.limit === 'number' && apiPagination.limit > 0 ? apiPagination.limit : 24,
          total,
          totalPages,
          hasNextPage: typeof apiPagination.hasNextPage === 'boolean' ? apiPagination.hasNextPage : currentPage < totalPages,
          hasPrevPage: typeof apiPagination.hasPrevPage === 'boolean' ? apiPagination.hasPrevPage : currentPage > 1,
        });

        setFacets({
          crafts: normalizeFacetOptions(facetsData.crafts),
          regions: normalizeFacetOptions(facetsData.regions),
          materials: normalizeFacetOptions(facetsData.materials),
          occasions: normalizeFacetOptions(facetsData.occasions),
          badges: normalizeFacetOptions(facetsData.badges),
          priceRange: {
            minPaise: typeof facetsData.priceRange?.minPaise === 'number' ? facetsData.priceRange.minPaise : 0,
            maxPaise: typeof facetsData.priceRange?.maxPaise === 'number' ? facetsData.priceRange.maxPaise : 0,
          },
          total: typeof facetsData.total === 'number' ? facetsData.total : total,
        });
        setCategory(normalizeCategory(facetsData.matchedCategory || productsData.matchedCategory, slug));
      } catch (error) {
        if (cancelled) return;
        console.error('[PLP slug] load failed', error);
        setProducts([]);
        setFacets(emptyFacets());
        setPagination(EMPTY_PAGINATION);
        setCategory(asCategoryFallback(slug));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [slug, filters, router]);

  const activeFilters = Object.entries(filters).filter(([key, value]) => value && key !== 'sort' && key !== 'q' && key !== 'page').length;
  const categoryName = category?.name || titleFromSlug(slug);

  return (
    <>
      <Header />

      <section className="relative overflow-hidden bg-paper-deep/70 border-b border-mitti/15">
        <div className="absolute inset-0 opacity-[0.18] bg-[radial-gradient(circle_at_center,rgba(107,68,35,0.22)_0_1px,transparent_1.5px)] [background-size:21px_21px]" />
        <div className="relative max-w-[1680px] mx-auto px-6 lg:px-12 py-11 md:py-16 grid grid-cols-[1fr_auto] items-center gap-6">
          <div>
            <Link href="/" className="font-ui text-[9px] tracking-[0.2em] text-mitti hover:text-madder">HOME</Link>
            {!!category?.breadcrumb?.length && (
              <p className="font-ui text-[9px] tracking-[0.17em] text-mitti/75 mt-3">{category.breadcrumb.join(' / ').toUpperCase()}</p>
            )}
            <p className="editorial-kicker mt-7">THE NEEJEE EDIT</p>
            <h1 className="font-display text-[44px] sm:text-[56px] lg:text-[64px] leading-[0.98] text-kohl mt-2">{categoryName}</h1>
            <p className="font-display italic text-mitti text-[16px] md:text-[18px] mt-4">
              {loading ? 'Gathering the edit…' : `${pagination.total} ${pagination.total === 1 ? 'piece' : 'pieces'}, curated by hand.`}
            </p>
          </div>

          <div className="hidden sm:flex w-28 h-28 lg:w-36 lg:h-36 rounded-full border border-madder/55 items-center justify-center rotate-[-7deg]">
            <div className="w-[82%] h-[82%] rounded-full border border-madder/35 flex flex-col items-center justify-center text-center px-3">
              <span className="font-ui text-[8px] tracking-[0.18em] text-madder">FOUND.</span>
              <span className="font-display italic text-[17px] text-madder mt-1">Personal.</span>
              <span className="font-ui text-[7px] tracking-[0.16em] text-mitti mt-1">NEEJEE SELECT</span>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-[72px] lg:top-[88px] z-30 bg-ivory/96 backdrop-blur-sm border-b border-mitti/15">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-12 py-3.5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="lg:hidden flex-1 bg-mitti text-ivory px-4 py-3 font-ui text-[10px] tracking-[0.18em] flex items-center justify-center gap-2"
            aria-haspopup="dialog"
            aria-expanded={mobileFiltersOpen}
          >
            <Filter className="w-4 h-4" strokeWidth={1.4} /> FILTER {activeFilters > 0 ? `· ${activeFilters}` : ''}
          </button>

          <p className="hidden lg:block font-ui text-[9px] tracking-[0.18em] text-mitti">
            {activeFilters > 0 ? `${activeFilters} FILTER${activeFilters > 1 ? 'S' : ''} APPLIED` : `${pagination.total} PIECE${pagination.total === 1 ? '' : 'S'}`}
          </p>

          <div className="flex items-center gap-3 flex-1 lg:flex-none">
            {activeFilters > 0 && (
              <button type="button" onClick={clearAll} className="hidden sm:block micro-link whitespace-nowrap">CLEAR ALL</button>
            )}
            <div className="relative flex-1 lg:flex-none">
              <SlidersHorizontal className="lg:hidden w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-ivory z-10" strokeWidth={1.4} />
              <select
                value={filters.sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="w-full lg:w-auto appearance-none bg-mitti lg:bg-transparent text-ivory lg:text-kohl border lg:border-mitti/25 border-mitti px-9 lg:pl-4 py-3 lg:py-2.5 pr-9 font-ui text-[10px] tracking-[0.14em] cursor-pointer"
                aria-label="Sort products"
              >
                <option className="text-kohl" value="newest">NEWEST</option>
                <option className="text-kohl" value="price_asc">PRICE · LOW TO HIGH</option>
                <option className="text-kohl" value="price_desc">PRICE · HIGH TO LOW</option>
                <option className="text-kohl" value="name">NAME · A–Z</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.3} aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1680px] mx-auto px-5 sm:px-8 lg:px-12 py-10 md:py-12 grid grid-cols-1 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr] gap-10 xl:gap-14">
        <aside className="hidden lg:block border-r border-mitti/15 pr-8 xl:pr-10">
          <p className="editorial-kicker mb-7">REFINE THE EDIT</p>
          <FilterPanel facets={facets} filters={filters} setParam={setParam} />
        </aside>

        {mobileFiltersOpen && (
          <div className="lg:hidden fixed inset-0 bg-kohl/55 z-50 flex items-end" onClick={() => setMobileFiltersOpen(false)} role="presentation">
            <div onClick={(e) => e.stopPropagation()} className="bg-ivory w-full max-h-[88vh] overflow-y-auto p-6 border-t border-mitti/20" role="dialog" aria-modal="true" aria-labelledby="mobile-filter-title">
              <div className="flex items-center justify-between mb-7 pb-5 border-b border-mitti/15">
                <div>
                  <p className="editorial-kicker">REFINE</p>
                  <h2 id="mobile-filter-title" className="font-display text-3xl text-kohl mt-1">The edit</h2>
                </div>
                <button type="button" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters" className="w-10 h-10 border border-mitti/20 flex items-center justify-center">
                  <X className="w-5 h-5" strokeWidth={1.4} aria-hidden="true" />
                </button>
              </div>
              <FilterPanel facets={facets} filters={filters} setParam={setParam} />
              <div className="sticky bottom-0 bg-ivory pt-5 pb-2 mt-6 border-t border-mitti/15 flex gap-3">
                {activeFilters > 0 && <button type="button" onClick={clearAll} className="btn-outline flex-1">CLEAR</button>}
                <button type="button" onClick={() => setMobileFiltersOpen(false)} className="btn-primary flex-[1.4]">SHOW {pagination.total}</button>
              </div>
            </div>
          </div>
        )}

        <div>
          {loading ? (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-9 md:gap-7" aria-label="Loading products" aria-busy="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index}>
                  <div className="aspect-square sm:aspect-[4/3] bg-beige animate-pulse" />
                  <div className="h-3 bg-beige mt-4 w-2/3 animate-pulse" />
                  <div className="h-3 bg-beige mt-2 w-1/3 animate-pulse" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="paper-panel py-20 px-6 text-center">
              <p className="editorial-kicker">THE EDIT CONTINUES</p>
              <h2 className="font-display text-3xl text-kohl mt-3">Nothing matches this selection yet.</h2>
              <p className="font-display italic text-mitti mt-3">Remove a filter to widen the edit.</p>
              {activeFilters > 0 && <button type="button" onClick={clearAll} className="btn-outline mt-7">CLEAR ALL FILTERS</button>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-10 sm:gap-x-6 lg:gap-x-8 lg:gap-y-12">
                {products.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>

              {pagination.totalPages > 1 && (
                <nav className="mt-16 pt-8 border-t border-mitti/15 flex items-center justify-center gap-4" aria-label="Product pages">
                  <button type="button" disabled={!pagination.hasPrevPage || loading} onClick={() => setParam('page', String(Math.max(1, pagination.page - 1)))} className="btn-outline min-w-[118px] disabled:opacity-35 disabled:cursor-not-allowed">PREVIOUS</button>
                  <span className="font-ui text-[9px] tracking-[0.18em] text-mitti" aria-live="polite">PAGE {pagination.page} OF {pagination.totalPages}</span>
                  <button type="button" disabled={!pagination.hasNextPage || loading} onClick={() => setParam('page', String(Math.min(pagination.totalPages, pagination.page + 1)))} className="btn-outline min-w-[118px] disabled:opacity-35 disabled:cursor-not-allowed">NEXT</button>
                </nav>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

function FilterPanel({ facets, filters, setParam }: {
  facets: FacetsState;
  filters: { craft: string; region: string; material: string; occasion: string; badge: string; minPrice: string; maxPrice: string; sort: string; q: string; page: number };
  setParam: (key: string, value: string) => void;
}) {
  const minR = paiseToRupees(facets.priceRange.minPaise || 0);
  const maxR = paiseToRupees(facets.priceRange.maxPaise || 0);

  return (
    <div className="space-y-7">
      <FilterGroup title="Craft" current={filters.craft} options={facets.crafts} onChange={(v) => setParam('craft', v)} />
      <FilterGroup title="Region" current={filters.region} options={facets.regions} onChange={(v) => setParam('region', v)} />
      <FilterGroup title="Material" current={filters.material} options={facets.materials} onChange={(v) => setParam('material', v)} />
      <FilterGroup title="Occasion" current={filters.occasion} options={facets.occasions} onChange={(v) => setParam('occasion', v)} />
      <FilterGroup title="Badges & seals" current={filters.badge} options={facets.badges} onChange={(v) => setParam('badge', v)} />

      <div className="pt-1">
        <p className="font-ui text-[9px] tracking-[0.19em] text-kohl mb-3">PRICE · ₹</p>
        <div className="flex gap-2 items-center">
          <input type="number" min="0" placeholder={String(minR || 0)} value={filters.minPrice} onChange={(e) => setParam('minPrice', e.target.value)} className="neejee-field !py-2.5 !px-3 text-xs min-w-0" aria-label="Minimum price" />
          <span className="text-mitti">–</span>
          <input type="number" min="0" placeholder={String(maxR || 50000)} value={filters.maxPrice} onChange={(e) => setParam('maxPrice', e.target.value)} className="neejee-field !py-2.5 !px-3 text-xs min-w-0" aria-label="Maximum price" />
        </div>
        {(minR || maxR) ? <p className="font-ui text-[9px] tracking-wide text-mitti mt-2">{formatINR(facets.priceRange.minPaise)} – {formatINR(facets.priceRange.maxPaise)}</p> : null}
      </div>
    </div>
  );
}

function FilterGroup({ title, current, options, onChange }: { title: string; current: string; options: FacetTuple[]; onChange: (value: string) => void }) {
  if (!options?.length) return null;
  return (
    <div className="pb-6 border-b border-mitti/12 last:border-0">
      <p className="font-ui text-[9px] tracking-[0.19em] text-kohl mb-3">{title.toUpperCase()}</p>
      <div className="space-y-2">
        {options.slice(0, 10).map(([name, count]) => (
          <button key={name} type="button" onClick={() => onChange(current === name ? '' : name)} aria-pressed={current === name} className={`flex items-center justify-between w-full text-left py-0.5 transition-colors ${current === name ? 'text-madder' : 'text-kohl/75 hover:text-madder'}`}>
            <span className="font-display text-[14px]">{name}</span>
            <span className="font-ui text-[9px] text-mitti">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PLPPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ivory p-12 font-display italic text-mitti">Gathering the edit…</div>}>
      <PLPInner />
    </Suspense>
  );
}
