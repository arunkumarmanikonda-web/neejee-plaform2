'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Filter, X, ChevronDown } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  ProductCard,
  type ProductCardData,
} from '@/components/product/ProductCard';
import { formatINR, paiseToRupees } from '@/lib/money';

export const dynamic = 'force-dynamic';

type FacetTuple = [string, number];

type ProductsResponse = {
  matchedCategory?: {
    name?: string;
    slug?: string;
    path?: string | null;
  } | null;
  readModel?: {
    version?: string;
  };
  products?: any[];
  count?: number;
  error?: string;
};

type FacetsResponse = {
  ok?: boolean;
  matchedCategory?: {
    name?: string;
    slug?: string;
    path?: string | null;
  } | null;
  readModel?: {
    version?: string;
  };
  crafts?: FacetTuple[];
  regions?: FacetTuple[];
  materials?: FacetTuple[];
  occasions?: FacetTuple[];
  badges?: FacetTuple[];
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

function featuredHeading(featured: string, q: string) {
  if (featured === 'founder') {
    return {
      eyebrow: "FOUNDER'S EDIT",
      title: "Founder's Edit",
      subtitle:
        'A handpicked selection of signature pieces with strong narrative and collector appeal.',
    };
  }

  if (featured === 'sale') {
    return {
      eyebrow: 'ON SALE',
      title: 'On Sale',
      subtitle:
        'Current reductions across craft-led pieces, still curated with the same editorial standard.',
    };
  }

  if (featured === 'new') {
    return {
      eyebrow: 'NEW ARRIVALS',
      title: 'New Arrivals',
      subtitle:
        'The latest additions from verified makers and fresh curation drops across the catalogue.',
    };
  }

  if (featured === 'catalogue') {
    return {
      eyebrow: 'CATALOGUE PICKS',
      title: 'Catalogue Picks',
      subtitle:
        'Merchandised highlights surfaced through the updated catalogue read model.',
    };
  }

  if (featured === 'bestseller') {
    return {
      eyebrow: 'BESTSELLERS',
      title: 'Bestsellers',
      subtitle:
        'Pieces customers return to again and again across craft, occasion, and gifting.',
    };
  }

  if (featured === 'editorial') {
    return {
      eyebrow: 'EDITORIAL',
      title: 'Editorial Selection',
      subtitle:
        'Story-led, image-led, and curation-led pieces intended for stronger brand expression.',
    };
  }

  if (featured === 'hero') {
    return {
      eyebrow: 'HERO PRODUCTS',
      title: 'Hero Products',
      subtitle:
        'Pinned hero products intended to lead storefront storytelling and discovery.',
    };
  }

  if (q) {
    return {
      eyebrow: 'SEARCH RESULTS',
      title: `Search: ${q}`,
      subtitle:
        'Filtered across the public products feed using the storefront search/read-model contract.',
    };
  }

  return {
    eyebrow: 'THE COLLECTION',
    title: 'All Crafts',
    subtitle:
      'Hand-curated artefacts from master craftspeople across India. Each piece carries its story.',
  };
}

function PLPInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp?.toString() || '';

  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [facets, setFacets] = useState<FacetsState>({
    crafts: [],
    regions: [],
    materials: [],
    occasions: [],
    badges: [],
    priceRange: { minPaise: 0, maxPaise: 0 },
    total: 0,
  });
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
      featured: params.get('featured') || '',
    };
  }, [spKey]);

  const hero = useMemo(
    () => featuredHeading(filters.featured, filters.q),
    [filters.featured, filters.q]
  );

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(spKey);
    if (value) next.set(key, value);
    else next.delete(key);

    const qs = next.toString();
    router.push(qs ? `/products?${qs}` : '/products');
  };

  const clearAll = () => router.push('/products');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) qs.set(key, value);
      });
      qs.set('limit', '60');

      setLoading(true);

      try {
        const [productsRes, facetsRes] = await Promise.all([
          fetch(`/api/products?${qs.toString()}`, { cache: 'no-store' }),
          fetch('/api/facets', { cache: 'no-store' }),
        ]);

        const productsData: ProductsResponse = productsRes.ok
          ? await productsRes.json()
          : { products: [], count: 0, error: `products ${productsRes.status}` };

        const facetsData: FacetsResponse = facetsRes.ok
          ? await facetsRes.json()
          : {
              crafts: [],
              regions: [],
              materials: [],
              occasions: [],
              badges: [],
              priceRange: { minPaise: 0, maxPaise: 0 },
              total: 0,
              error: `facets ${facetsRes.status}`,
            };

        if (cancelled) return;

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
              : nextProducts.length,
        });
      } catch (error) {
        if (cancelled) return;

        setProducts([]);
        setFacets({
          crafts: [],
          regions: [],
          materials: [],
          occasions: [],
          badges: [],
          priceRange: { minPaise: 0, maxPaise: 0 },
          total: 0,
        });
        console.error('[PLP all products] load failed', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => value && key !== 'sort'
  ).length;

  return (
    <div className="min-h-screen bg-ivory">
      <Header />

      <section className="bg-kohl text-ivory py-12 md:py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs tracking-[0.3em] text-banarasi mb-3">
            {hero.eyebrow}
          </p>
          <h1 className="font-display text-4xl md:text-6xl mb-3">
            {hero.title}
          </h1>
          <p className="text-ivory/70 max-w-2xl">{hero.subtitle}</p>
        </div>
      </section>

      <div className="border-b border-kohl/10 bg-ivory sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMobileFiltersOpen(true)}
            className="md:hidden flex items-center gap-2 text-sm tracking-wider"
          >
            <Filter className="w-4 h-4" /> FILTERS{' '}
            {activeFilterCount > 0 && (
              <span className="bg-madder text-ivory px-2 rounded-full text-xs">
                {activeFilterCount}
              </span>
            )}
          </button>

          <p className="text-xs tracking-wider text-kohl/60 hidden md:block">
            {loading
              ? 'Loading…'
              : `${products.length} of ${facets.total} pieces`}
          </p>

          <div className="flex items-center gap-3">
            <label className="text-xs tracking-wider text-kohl/60 hidden md:inline">
              SORT
            </label>
            <div className="relative">
              <select
                value={filters.sort}
                onChange={(e) => setParam('sort', e.target.value)}
                className="appearance-none border border-kohl/20 px-3 py-1.5 pr-9 text-sm bg-ivory focus:outline-none focus:border-kohl"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name (A–Z)</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-kohl/60" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-[260px_1fr] gap-8">
        <aside className="hidden md:block">
          <FilterPanel
            facets={facets}
            filters={filters}
            setParam={setParam}
            clearAll={clearAll}
            activeCount={activeFilterCount}
          />
        </aside>

        {mobileFiltersOpen && (
          <div
            className="fixed inset-0 z-50 bg-kohl/40 md:hidden"
            onClick={() => setMobileFiltersOpen(false)}
          >
            <div
              className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-ivory p-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-2xl">Filters</h3>
                <button onClick={() => setMobileFiltersOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <FilterPanel
                facets={facets}
                filters={filters}
                setParam={setParam}
                clearAll={clearAll}
                activeCount={activeFilterCount}
              />
            </div>
          </div>
        )}

        <div>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] bg-kohl/5 animate-pulse rounded"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-display text-3xl mb-3">Nothing here yet</p>
              <p className="text-kohl/60 mb-6">
                Try clearing filters or searching another craft.
              </p>
              <button
                onClick={clearAll}
                className="px-6 py-3 bg-kohl text-ivory text-sm tracking-wider hover:bg-kohl/90"
              >
                CLEAR FILTERS
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

function FilterPanel({
  facets,
  filters,
  setParam,
  clearAll,
  activeCount,
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
    featured: string;
  };
  setParam: (key: string, value: string) => void;
  clearAll: () => void;
  activeCount: number;
}) {
  const minR = paiseToRupees(facets.priceRange.minPaise || 0);
  const maxR = paiseToRupees(facets.priceRange.maxPaise || 0);

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-[0.2em] text-kohl/60">REFINE</p>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs underline text-madder">
            Clear all
          </button>
        )}
      </div>

      <FacetGroup
        label="Craft"
        items={facets.crafts}
        active={filters.craft}
        onChange={(v) => setParam('craft', v)}
      />
      <FacetGroup
        label="Region"
        items={facets.regions}
        active={filters.region}
        onChange={(v) => setParam('region', v)}
      />
      <FacetGroup
        label="Material"
        items={facets.materials}
        active={filters.material}
        onChange={(v) => setParam('material', v)}
      />
      <FacetGroup
        label="Occasion"
        items={facets.occasions}
        active={filters.occasion}
        onChange={(v) => setParam('occasion', v)}
      />
      <FacetGroup
        label="Badges & Seals"
        items={facets.badges}
        active={filters.badge}
        onChange={(v) => setParam('badge', v)}
      />

      <div>
        <p className="text-xs tracking-[0.2em] text-kohl/60 mb-3">PRICE (₹)</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder={String(minR || 0)}
            value={filters.minPrice}
            onChange={(e) => setParam('minPrice', e.target.value)}
            className="w-full border border-kohl/20 px-3 py-2 bg-ivory text-sm"
          />
          <span className="text-kohl/40">–</span>
          <input
            type="number"
            placeholder={String(maxR || 50000)}
            value={filters.maxPrice}
            onChange={(e) => setParam('maxPrice', e.target.value)}
            className="w-full border border-kohl/20 px-3 py-2 bg-ivory text-sm"
          />
        </div>

        {(minR || maxR) && (
          <p className="font-ui text-[10px] text-mitti mt-2">
            Range: {formatINR(facets.priceRange.minPaise)} –{' '}
            {formatINR(facets.priceRange.maxPaise)}
          </p>
        )}
      </div>
    </div>
  );
}

function FacetGroup({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: FacetTuple[];
  active: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(true);

  if (!items || items.length === 0) return null;

  return (
    <div className="border-t border-kohl/10 pt-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between mb-3"
      >
        <span className="text-xs tracking-[0.2em] text-kohl/60">
          {label.toUpperCase()}
        </span>
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {items.map(([name, count]) => (
            <label
              key={name}
              className="flex items-center justify-between cursor-pointer hover:text-madder"
            >
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
