'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Filter, X, ChevronDown } from 'lucide-react';
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

type RedirectResponse = {
  found?: boolean;
  toSlug?: string;
  permanent?: boolean;
};

type ProductsResponse = {
  ok?: boolean;
  matchedCategory?: CategorySummary | null;
  readModel?: {
    version?: string;
  };
  products?: any[];
  count?: number;
  error?: string;
};

type FacetsResponse = {
  ok?: boolean;
  matchedCategory?: CategorySummary | null;
  readModel?: {
    version?: string;
  };
  crafts?: FacetTuple[];
  regions?: FacetTuple[];
  materials?: FacetTuple[];
  occasions?: FacetTuple[];
  badges?: FacetTuple[];
  audienceTags?: FacetTuple[];
  priceRange?: {
    minPaise?: number;
    maxPaise?: number;
  };
  total?: number;
  error?: string;
};

type FacetsState = {
  crafts: FacetTuple[];
  regions: FacetTuple[];
  materials: FacetTuple[];
  occasions: FacetTuple[];
  badges: FacetTuple[];
  priceRange: {
    minPaise: number;
    maxPaise: number;
  };
  total: number;
};

function titleFromSlug(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pathToBreadcrumbs(path: string | null | undefined) {
  if (!path) return { breadcrumb: undefined, breadcrumbSlugs: undefined };

  const breadcrumbSlugs = path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!breadcrumbSlugs.length) {
    return { breadcrumb: undefined, breadcrumbSlugs: undefined };
  }

  return {
    breadcrumb: breadcrumbSlugs.map(titleFromSlug),
    breadcrumbSlugs,
  };
}

function normalizeCategory(summary: CategorySummary | null | undefined, fallbackSlug: string): CategorySummary {
  if (!summary) return asCategoryFallback(fallbackSlug);

  const derived = pathToBreadcrumbs(summary.path);

  return {
    ...summary,
    name: summary.name || titleFromSlug(summary.slug || fallbackSlug),
    slug: summary.slug || fallbackSlug,
    breadcrumb:
      Array.isArray(summary.breadcrumb) && summary.breadcrumb.length > 0
        ? summary.breadcrumb
        : derived.breadcrumb || [titleFromSlug(summary.slug || fallbackSlug)],
    breadcrumbSlugs:
      Array.isArray(summary.breadcrumbSlugs) && summary.breadcrumbSlugs.length > 0
        ? summary.breadcrumbSlugs
        : derived.breadcrumbSlugs || [summary.slug || fallbackSlug],
  };
}

function asCategoryFallback(slug: string): CategorySummary {
  return {
    name: titleFromSlug(slug),
    slug,
    path: slug,
    breadcrumb: [titleFromSlug(slug)],
    breadcrumbSlugs: [slug],
  };
}

function normalizeFacetOptions(options: unknown): FacetTuple[] {
  if (!Array.isArray(options)) return [];
  return options.filter(
    (item): item is FacetTuple =>
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === 'string' &&
      typeof item[1] === 'number'
  );
}

function mapProductToCardData(product: any): ProductCardData {
  const images = Array.isArray(product?.images)
    ? product.images.filter(
        (img: unknown): img is string =>
          typeof img === 'string' && img.trim().length > 0
      )
    : typeof product?.primaryImage === 'string' &&
      product.primaryImage.trim().length > 0
    ? [product.primaryImage]
    : [];

  return {
    id: String(product?.id ?? ''),
    slug: String(product?.slug ?? ''),
    name: String(product?.name ?? 'Untitled Product'),
    poeticLine:
      typeof product?.poeticLine === 'string' ? product.poeticLine : null,
    craft: typeof product?.craft === 'string' ? product.craft : null,
    region: typeof product?.region === 'string' ? product.region : null,
    mrp: typeof product?.mrp === 'number' ? product.mrp : 0,
    sellingPrice:
      typeof product?.sellingPrice === 'number' ? product.sellingPrice : 0,
    salePrice:
      typeof product?.salePrice === 'number' ? product.salePrice : null,
    saleStartsAt: product?.saleStartsAt ?? null,
    saleEndsAt: product?.saleEndsAt ?? null,
    images,
    badges: Array.isArray(product?.badges)
      ? product.badges.filter(
          (badge: unknown): badge is string =>
            typeof badge === 'string' && badge.trim().length > 0
        )
      : [],
    inventory:
      typeof product?.inventory === 'number' ? product.inventory : undefined,
    aiTryOnEligible: !!product?.aiTryOnEligible,
  };
}

function emptyFacets(): FacetsState {
  return {
    crafts: [],
    regions: [],
    materials: [],
    occasions: [],
    badges: [],
    priceRange: { minPaise: 0, maxPaise: 0 },
    total: 0,
  };
}

function PLPInner() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp?.toString() || '';
  const slug = String(params?.slug || '').trim();

  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [facets, setFacets] = useState<FacetsState>(emptyFacets());
  const [category, setCategory] = useState<CategorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = useMemo(() => {
    const params = new URLSearchParams(spKey);
    return {
      craft: params.get('craft') || '',
      region: params.get('region') || '',
      material: params.get('material') || '',
      occasion: params.get('occasion') || '',
      badge: params.get('badge') || '',
      minPrice: params.get('minPrice') || '',
      maxPrice: params.get('maxPrice') || '',
      sort: params.get('sort') || 'newest',
      q: params.get('q') || '',
    };
  }, [spKey]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(spKey);

    if (value) next.set(key, value);
    else next.delete(key);

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
        setCategory(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const redirectRes = await fetch(
          `/api/categories/redirect?slug=${encodeURIComponent(slug)}`,
          { cache: 'no-store' }
        );

        if (redirectRes.ok) {
          const redirectData: RedirectResponse = await redirectRes.json();
          if (
            redirectData?.found &&
            redirectData?.toSlug &&
            redirectData.toSlug !== slug
          ) {
            router.replace(`/categories/${redirectData.toSlug}`);
            return;
          }
        }

        const qs = new URLSearchParams();
        qs.set('category', slug);

        Object.entries(filters).forEach(([key, value]) => {
          if (value) qs.set(key, value);
        });

        const [productsResult, facetsResult] = await Promise.allSettled([
          fetch(`/api/products?${qs.toString()}`, { cache: 'no-store' }),
          fetch(`/api/facets?${qs.toString()}`, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        let productsData: ProductsResponse = { products: [], count: 0 };
        let facetsData: FacetsResponse = {
          crafts: [],
          regions: [],
          materials: [],
          occasions: [],
          badges: [],
          priceRange: { minPaise: 0, maxPaise: 0 },
          total: 0,
        };

        if (productsResult.status === 'fulfilled' && productsResult.value.ok) {
          productsData = await productsResult.value.json();
        }

        if (facetsResult.status === 'fulfilled' && facetsResult.value.ok) {
          facetsData = await facetsResult.value.json();
        }

        const nextProducts = Array.isArray(productsData?.products)
          ? productsData.products
              .map(mapProductToCardData)
              .filter((product) => product.id && product.slug)
          : [];

        setProducts(nextProducts);

        setFacets({
          crafts: normalizeFacetOptions(facetsData?.crafts),
          regions: normalizeFacetOptions(facetsData?.regions),
          materials: normalizeFacetOptions(facetsData?.materials),
          occasions: normalizeFacetOptions(facetsData?.occasions),
          badges: normalizeFacetOptions(facetsData?.badges),
          priceRange: {
            minPaise:
              typeof facetsData?.priceRange?.minPaise === 'number'
                ? facetsData.priceRange.minPaise
                : 0,
            maxPaise:
              typeof facetsData?.priceRange?.maxPaise === 'number'
                ? facetsData.priceRange.maxPaise
                : 0,
          },
          total:
            typeof facetsData?.total === 'number'
              ? facetsData.total
              : typeof productsData?.count === 'number'
              ? productsData.count
              : nextProducts.length,
        });

        setCategory(
          normalizeCategory(
            facetsData?.matchedCategory || productsData?.matchedCategory,
            slug
          )
        );
      } catch (error) {
        if (cancelled) return;

        console.error('[PLP slug] load failed', error);
        setProducts([]);
        setFacets(emptyFacets());
        setCategory(asCategoryFallback(slug));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [slug, filters, router]);

  const activeFilters = Object.entries(filters).filter(
    ([key, value]) => value && key !== 'sort' && key !== 'q'
  ).length;

  return (
    <>
      <Header />

      <section className="max-w-8xl mx-auto px-6 lg:px-12 pt-10 pb-6">
        <Link href="/" className="label text-mitti hover:text-madder">
          HOME
        </Link>

        {!!category?.breadcrumb?.length && (
          <p className="font-ui text-[11px] tracking-[0.18em] text-mitti mt-4">
            {category.breadcrumb.join(' / ').toUpperCase()}
          </p>
        )}

        <h1 className="font-display text-4xl lg:text-5xl text-kohl mt-2">
          {category?.name || titleFromSlug(slug)}
        </h1>

        <p className="font-italic italic text-mitti mt-2">
          {loading
            ? 'Loading...'
            : `${products.length} pieces · India's finest craft, curated by hand`}
        </p>

        <div className="madder-divider mt-4" />
      </section>

      <section className="max-w-8xl mx-auto px-6 lg:px-12 sticky top-20 z-30 bg-ivory border-b border-beige py-4 flex items-center justify-between gap-4">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="lg:hidden btn-outline text-xs flex items-center gap-2"
        >
          <Filter className="w-4 h-4" /> FILTERS{' '}
          {activeFilters > 0 && `(${activeFilters})`}
        </button>

        <p className="hidden lg:block font-ui text-xs tracking-widest text-mitti">
          {activeFilters > 0
            ? `${activeFilters} FILTER${activeFilters > 1 ? 'S' : ''} APPLIED`
            : 'ALL ITEMS'}
        </p>

        <div className="flex items-center gap-3">
          {activeFilters > 0 && (
            <button
              onClick={clearAll}
              className="font-ui text-xs text-madder hover:underline"
            >
              CLEAR ALL
            </button>
          )}

          <div className="relative">
            <select
              value={filters.sort}
              onChange={(e) => setParam('sort', e.target.value)}
              className="appearance-none bg-beige px-4 py-2 pr-9 font-ui text-xs tracking-widest cursor-pointer"
            >
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
        <aside className="hidden lg:block">
          <FilterPanel facets={facets} filters={filters} setParam={setParam} />
        </aside>

        {mobileFiltersOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-kohl/60 z-50 flex items-end"
            onClick={() => setMobileFiltersOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-ivory w-full max-h-[85vh] overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl text-kohl">Filters</h2>
                <button onClick={() => setMobileFiltersOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <FilterPanel facets={facets} filters={filters} setParam={setParam} />

              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="btn-primary w-full mt-6"
              >
                APPLY FILTERS · {products.length}
              </button>
            </div>
          </div>
        )}

        <div>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-[3/4] bg-beige animate-pulse"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-20 text-center">
              <p className="font-display text-2xl text-kohl">
                Nothing matches yet.
              </p>
              <p className="font-italic italic text-mitti mt-2">
                Try removing some filters.
              </p>
              {activeFilters > 0 && (
                <button onClick={clearAll} className="btn-outline mt-6">
                  CLEAR ALL FILTERS
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

function FilterPanel({
  facets,
  filters,
  setParam,
}: {
  facets: FacetsState;
  filters: {
    craft: string;
    region: string;
    material: string;
    occasion: string;
    badge: string;
    minPrice: string;
    maxPrice: string;
    sort: string;
    q: string;
  };
  setParam: (key: string, value: string) => void;
}) {
  const minR = paiseToRupees(facets.priceRange?.minPaise || 0);
  const maxR = paiseToRupees(facets.priceRange?.maxPaise || 0);

  return (
    <div className="space-y-6 font-ui text-sm">
      <FilterGroup
        title="Craft"
        current={filters.craft}
        options={facets.crafts}
        onChange={(v) => setParam('craft', v)}
      />
      <FilterGroup
        title="Region"
        current={filters.region}
        options={facets.regions}
        onChange={(v) => setParam('region', v)}
      />
      <FilterGroup
        title="Material"
        current={filters.material}
        options={facets.materials}
        onChange={(v) => setParam('material', v)}
      />
      <FilterGroup
        title="Occasion"
        current={filters.occasion}
        options={facets.occasions}
        onChange={(v) => setParam('occasion', v)}
      />
      <FilterGroup
        title="Badges & Seals"
        current={filters.badge}
        options={facets.badges}
        onChange={(v) => setParam('badge', v)}
      />

      <div>
        <p className="label text-kohl mb-3">PRICE (₹)</p>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min="0"
            placeholder={String(minR || 0)}
            value={filters.minPrice}
            onChange={(e) => setParam('minPrice', e.target.value)}
            className="w-20 p-2 bg-beige border border-mitti/20 text-xs"
          />
          <span className="text-mitti">-</span>
          <input
            type="number"
            min="0"
            placeholder={String(maxR || 50000)}
            value={filters.maxPrice}
            onChange={(e) => setParam('maxPrice', e.target.value)}
            className="w-20 p-2 bg-beige border border-mitti/20 text-xs"
          />
        </div>

        {(minR || maxR) && (
          <p className="font-ui text-[10px] text-mitti mt-2">
            Range: {formatINR(facets.priceRange.minPaise)} -{' '}
            {formatINR(facets.priceRange.maxPaise)}
          </p>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  title,
  current,
  options,
  onChange,
}: {
  title: string;
  current: string;
  options: FacetTuple[];
  onChange: (value: string) => void;
}) {
  if (!options || options.length === 0) return null;

  return (
    <div>
      <p className="label text-kohl mb-3">{title.toUpperCase()}</p>
      <div className="space-y-1.5">
        {options.slice(0, 10).map(([name, count]) => (
          <button
            key={name}
            onClick={() => onChange(current === name ? '' : name)}
            className={`flex items-center justify-between w-full text-left text-xs py-1 ${
              current === name
                ? 'text-madder font-medium'
                : 'text-kohl hover:text-madder'
            }`}
          >
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
