'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

type ProductImage = {
  url: string;
  alt: string;
};

type Breadcrumb = {
  name: string;
  href: string;
};

type VariantState = {
  id: string;
  sku: string | null;
  title: string;
  color: string | null;
  size: string | null;
  images: ProductImage[];
  inventory: number;
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  badges: string[];
};

type ProductState = {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  poeticLine: string | null;
  description: string | null;
  shortDescription: string | null;
  craft: string | null;
  region: string | null;
  material: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  breadcrumbs: Breadcrumb[];
  badges: string[];
  images: ProductImage[];
  inventory: number;
  visibleInventory: number;
  stockLabel: string | null;
  stockVisibility: string | null;
  isInStock: boolean;
  lowStock: boolean;
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  saleStartAt: string | null;
  saleEndAt: string | null;
  aiTryOnEligible: boolean;
  arEnabled: boolean;
  variants: VariantState[];
  craftStory: string | null;
  artisanStory: string | null;
  careInstructions: string | null;
  deliveryInfo: string | null;
  storyTitle: string | null;
  storyBody: string | null;
};

type NormalizedResponse = {
  product: ProductState | null;
  relatedProducts: unknown[];
  error: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item));
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }

  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeImageCandidate(value: unknown): ProductImage | null {
  if (typeof value === 'string' && value.trim()) {
    return { url: value.trim(), alt: 'Product image' };
  }

  if (!isObject(value)) return null;

  const url =
    asString(value.url) ??
    asString(value.src) ??
    asString(value.image) ??
    asString(value.imageUrl) ??
    asString(value.secure_url);

  if (!url) return null;

  return {
    url,
    alt:
      asString(value.alt) ??
      asString(value.label) ??
      asString(value.caption) ??
      'Product image',
  };
}

function normalizeImages(value: unknown): ProductImage[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: ProductImage[] = [];

  for (const item of value) {
    const normalized = normalizeImageCandidate(item);
    if (!normalized) continue;
    if (seen.has(normalized.url)) continue;
    seen.add(normalized.url);
    out.push(normalized);
  }

  return out;
}

function formatINR(paise: number | null): string {
  if (paise == null || !Number.isFinite(paise)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function isSaleLive(
  salePrice: number | null,
  saleStartAt: string | null,
  saleEndAt: string | null,
): boolean {
  if (salePrice == null) return false;

  const now = Date.now();
  const startsAt = saleStartAt ? Date.parse(saleStartAt) : Number.NaN;
  const endsAt = saleEndAt ? Date.parse(saleEndAt) : Number.NaN;

  if (Number.isFinite(startsAt) && startsAt > now) return false;
  if (Number.isFinite(endsAt) && endsAt < now) return false;

  return true;
}

function effectivePrice(
  mrp: number | null,
  sellingPrice: number | null,
  salePrice: number | null,
  saleStartAt: string | null,
  saleEndAt: string | null,
): number | null {
  if (isSaleLive(salePrice, saleStartAt, saleEndAt)) return salePrice;
  if (sellingPrice != null) return sellingPrice;
  return mrp;
}

function discountPct(
  mrp: number | null,
  sellingPrice: number | null,
  salePrice: number | null,
  saleStartAt: string | null,
  saleEndAt: string | null,
): number {
  const base = mrp;
  const current = effectivePrice(mrp, sellingPrice, salePrice, saleStartAt, saleEndAt);
  if (base == null || current == null || base <= 0 || current >= base) return 0;
  return Math.round(((base - current) / base) * 100);
}

function totalInventoryFromVariants(variants: VariantState[]): number {
  return variants.reduce((sum, variant) => sum + Math.max(0, variant.inventory), 0);
}

function normalizeBreadcrumbs(
  raw: unknown,
  fallbackCategoryName: string | null,
  fallbackCategorySlug: string | null,
): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [
    { name: 'Home', href: '/' },
    { name: 'Products', href: '/products' },
  ];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!isObject(item)) continue;
      const name = asString(item.name) ?? asString(item.label);
      const href =
        asString(item.href) ??
        asString(item.path) ??
        (asString(item.slug) ? `/categories/${asString(item.slug)}` : null);

      if (!name || !href) continue;
      breadcrumbs.push({ name, href });
    }
  } else if (fallbackCategoryName && fallbackCategorySlug) {
    breadcrumbs.push({
      name: fallbackCategoryName,
      href: `/categories/${fallbackCategorySlug}`,
    });
  }

  return breadcrumbs;
}

function normalizeVariant(raw: unknown): VariantState | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  if (!id) return null;

  const fallbackTitle = [asString(raw.color), asString(raw.size)]
    .filter((value): value is string => Boolean(value))
    .join(' / ');

  const title =
    asString(raw.title) ??
    asString(raw.name) ??
    (fallbackTitle || 'Variant');

  return {
    id,
    sku: asString(raw.sku),
    title,
    color: asString(raw.color),
    size: asString(raw.size),
    images: normalizeImages(raw.images),
    inventory:
      asNumber(raw.inventory) ??
      asNumber(raw.inventoryCount) ??
      asNumber(raw.stock) ??
      0,
    mrp: asNumber(raw.mrp),
    sellingPrice: asNumber(raw.sellingPrice),
    salePrice: asNumber(raw.salePrice),
    badges: dedupeStrings([
      ...toStringArray(raw.badges),
      ...toStringArray(raw.merchandisingBadges),
    ]),
  };
}

function normalizeVariants(raw: unknown): VariantState[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => normalizeVariant(item))
    .filter((item): item is VariantState => Boolean(item));
}

function normalizeProduct(raw: unknown): ProductState | null {
  if (!isObject(raw)) return null;

  const id = asString(raw.id);
  const slug = asString(raw.slug);
  const name = asString(raw.name);

  if (!id || !slug || !name) return null;

  const variants = normalizeVariants(raw.variants);
  const productImages = normalizeImages(raw.images);
  const variantImages = variants.flatMap((variant) => variant.images);

  const combinedImages = [...productImages, ...variantImages].filter(
    (image, index, arr) =>
      arr.findIndex((candidate) => candidate.url === image.url) === index,
  );

  const inventoryFromProduct =
    asNumber(raw.inventory) ??
    asNumber(raw.inventoryCount) ??
    asNumber(raw.stock) ??
    null;

  const visibleInventory =
    asNumber(raw.visibleInventory) ??
    asNumber(raw.stockVisibleQuantity) ??
    inventoryFromProduct ??
    totalInventoryFromVariants(variants);

  const inventory =
    inventoryFromProduct ??
    totalInventoryFromVariants(variants);

  const categoryName =
    asString(raw.categoryName) ??
    (isObject(raw.category) ? asString(raw.category.name) : null);

  const categorySlug =
    asString(raw.categorySlug) ??
    (isObject(raw.category) ? asString(raw.category.slug) : null);

  const craftStory =
    asString(raw.craftStory) ??
    asString(raw.story) ??
    asString(raw.craftNotes);

  const artisanStory =
    asString(raw.artisanStory) ??
    asString(raw.artisanNotes);

  const careInstructions =
    asString(raw.careInstructions) ??
    asString(raw.care) ??
    asString(raw.careGuide);

  const deliveryInfo =
    asString(raw.deliveryInfo) ??
    asString(raw.delivery) ??
    asString(raw.shippingInfo);

  const storyTitle =
    asString(raw.storyTitle) ??
    asString(raw.editorialTitle);

  const storyBody =
    asString(raw.storyBody) ??
    asString(raw.editorialStory) ??
    asString(raw.longDescription);

  const stockLabel =
    asString(raw.stockLabel) ??
    asString(raw.availabilityLabel);

  const isInStock =
    asBoolean(raw.isInStock) ||
    asBoolean(raw.inStock) ||
    visibleInventory > 0 ||
    inventory > 0;

  const lowStock =
    asBoolean(raw.lowStock) ||
    asBoolean(raw.isLowStock) ||
    (visibleInventory > 0 && visibleInventory <= 3);

  return {
    id,
    slug,
    name,
    subtitle: asString(raw.subtitle),
    poeticLine: asString(raw.poeticLine),
    description: asString(raw.description) ?? asString(raw.shortDescription),
    shortDescription: asString(raw.shortDescription),
    craft: asString(raw.craft),
    region: asString(raw.region),
    material: asString(raw.material),
    categoryName,
    categorySlug,
    breadcrumbs: normalizeBreadcrumbs(raw.breadcrumbs, categoryName, categorySlug),
    badges: dedupeStrings([
      ...toStringArray(raw.badges),
      ...toStringArray(raw.merchandisingBadges),
    ]),
    images: combinedImages,
    inventory,
    visibleInventory,
    stockLabel,
    stockVisibility: asString(raw.stockVisibility),
    isInStock,
    lowStock,
    mrp: asNumber(raw.mrp),
    sellingPrice: asNumber(raw.sellingPrice),
    salePrice: asNumber(raw.salePrice),
    saleStartAt: asString(raw.saleStartAt),
    saleEndAt: asString(raw.saleEndAt),
    aiTryOnEligible: asBoolean(raw.aiTryOnEligible),
    arEnabled: asBoolean(raw.arEnabled) || asBoolean(raw.arTryOnEligible),
    variants,
    craftStory,
    artisanStory,
    careInstructions,
    deliveryInfo,
    storyTitle,
    storyBody,
  };
}

function normalizeResponse(raw: unknown): NormalizedResponse {
  if (!isObject(raw)) {
    return { product: null, relatedProducts: [], error: 'Invalid response' };
  }

  const product =
    normalizeProduct(raw.product) ??
    normalizeProduct(raw.data) ??
    normalizeProduct(raw.item) ??
    normalizeProduct(raw);

  const relatedProducts = Array.isArray(raw.relatedProducts)
    ? raw.relatedProducts
    : Array.isArray(raw.related)
      ? raw.related
      : [];

  const error = asString(raw.error);

  return { product, relatedProducts, error };
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <div className="h-5 w-48 animate-pulse rounded bg-stone-200" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="aspect-[4/5] animate-pulse rounded-3xl bg-stone-200" />
          <div className="space-y-4">
            <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
            <div className="h-10 w-3/4 animate-pulse rounded bg-stone-200" />
            <div className="h-6 w-40 animate-pulse rounded bg-stone-200" />
            <div className="h-24 w-full animate-pulse rounded bg-stone-200" />
            <div className="h-12 w-full animate-pulse rounded bg-stone-200" />
            <div className="h-12 w-full animate-pulse rounded bg-stone-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center lg:px-10">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-stone-500">
          Product
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-900">
          Unable to load product
        </h1>
        <p className="mt-4 text-base text-stone-600">{message}</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/products"
            className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
          >
            Back to products
          </Link>
        </div>
      </div>
    </div>
  );
}

function DetailSection({
  title,
  content,
}: {
  title: string;
  content: string | null;
}) {
  if (!content) return null;

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-stone-700">
        {content}
      </p>
    </section>
  );
}

function PDPInner() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;

  const [product, setProduct] = useState<ProductState | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!slug) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/products/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });

        const json = await response.json().catch(() => null);
        const normalized = normalizeResponse(json);

        if (!response.ok) {
          throw new Error(normalized.error ?? 'Failed to load product');
        }

        if (!cancelled) {
          setProduct(normalized.product);
          setRelatedProducts(normalized.relatedProducts);
          setSelectedVariantId(null);
        }
      } catch (err) {
        if (!cancelled) {
          setProduct(null);
          setRelatedProducts([]);
          setError(err instanceof Error ? err.message : 'Failed to load product');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const selectedVariant = useMemo(() => {
    if (!product?.variants.length) return null;
    if (selectedVariantId) {
      return product.variants.find((variant) => variant.id === selectedVariantId) ?? null;
    }
    return product.variants.find((variant) => variant.inventory > 0) ?? product.variants[0] ?? null;
  }, [product, selectedVariantId]);

  const gallery = useMemo(() => {
    const variantImages = selectedVariant?.images ?? [];
    const combined = [...variantImages, ...(product?.images ?? [])];
    return combined.filter(
      (image, index, arr) =>
        arr.findIndex((candidate) => candidate.url === image.url) === index,
    );
  }, [product, selectedVariant]);

  useEffect(() => {
    setActiveImage(gallery[0]?.url ?? null);
  }, [gallery]);

  const displayPrice = useMemo(() => {
    const mrp = selectedVariant?.mrp ?? product?.mrp ?? null;
    const sellingPrice = selectedVariant?.sellingPrice ?? product?.sellingPrice ?? null;
    const salePrice = selectedVariant?.salePrice ?? product?.salePrice ?? null;
    const saleStartAt = product?.saleStartAt ?? null;
    const saleEndAt = product?.saleEndAt ?? null;

    return {
      mrp,
      sellingPrice,
      salePrice,
      effective: effectivePrice(mrp, sellingPrice, salePrice, saleStartAt, saleEndAt),
      onSale: isSaleLive(salePrice, saleStartAt, saleEndAt),
      discount: discountPct(mrp, sellingPrice, salePrice, saleStartAt, saleEndAt),
    };
  }, [product, selectedVariant]);

  const visibleInventory = selectedVariant?.inventory ?? product?.visibleInventory ?? 0;
  const isInStock = selectedVariant ? selectedVariant.inventory > 0 : (product?.isInStock ?? false);
  const lowStock = selectedVariant
    ? selectedVariant.inventory > 0 && selectedVariant.inventory <= 3
    : (product?.lowStock ?? false);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState message={error} />;
  if (!product) return <EmptyState message="This product could not be found." />;

  const primaryImage = activeImage ?? gallery[0]?.url ?? null;
  const badges = dedupeStrings([
    ...(product.badges || []),
    ...(selectedVariant?.badges || []),
    ...(displayPrice.onSale ? ['On Sale'] : []),
    ...(lowStock ? ['Low Stock'] : []),
    ...(!isInStock ? ['Sold Out'] : []),
  ]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
          {product.breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.href}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span>/</span> : null}
              <Link href={crumb.href} className="transition hover:text-stone-900">
                {crumb.name}
              </Link>
            </span>
          ))}
          <span>/</span>
          <span className="text-stone-900">{product.name}</span>
        </nav>

        <section className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt={product.name}
                  className="aspect-[4/5] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-stone-100 text-sm text-stone-500">
                  No image available
                </div>
              )}
            </div>

            {gallery.length > 1 ? (
              <div className="mt-4 grid grid-cols-5 gap-3">
                {gallery.map((image) => (
                  <button
                    key={image.url}
                    type="button"
                    onClick={() => setActiveImage(image.url)}
                    className={`overflow-hidden rounded-2xl border bg-white ${
                      activeImage === image.url
                        ? 'border-stone-900 ring-1 ring-stone-900'
                        : 'border-stone-200'
                    }`}
                  >
                    <img
                      src={image.url}
                      alt={image.alt}
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-stone-700"
                >
                  {badge}
                </span>
              ))}
              {product.aiTryOnEligible ? (
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-emerald-700">
                  Mirror
                </span>
              ) : null}
              {product.arEnabled ? (
                <span className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-sky-700">
                  AR
                </span>
              ) : null}
            </div>

            <div className="mt-5">
              {product.craft || product.region ? (
                <p className="text-sm uppercase tracking-[0.24em] text-stone-500">
                  {[product.craft, product.region].filter(Boolean).join(' · ')}
                </p>
              ) : null}

              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
                {product.name}
              </h1>

              {product.poeticLine ? (
                <p className="mt-3 text-lg text-stone-600">{product.poeticLine}</p>
              ) : null}

              {product.subtitle ? (
                <p className="mt-2 text-base text-stone-600">{product.subtitle}</p>
              ) : null}
            </div>

            <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-3xl font-semibold text-stone-900">
                  {formatINR(displayPrice.effective)}
                </span>

                {displayPrice.mrp != null &&
                displayPrice.effective != null &&
                displayPrice.mrp > displayPrice.effective ? (
                  <>
                    <span className="text-lg text-stone-400 line-through">
                      {formatINR(displayPrice.mrp)}
                    </span>
                    <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">
                      Save {displayPrice.discount}%
                    </span>
                  </>
                ) : null}
              </div>

              {product.stockLabel ? (
                <p className="mt-4 text-sm font-medium text-stone-700">{product.stockLabel}</p>
              ) : (
                <p className="mt-4 text-sm font-medium text-stone-700">
                  {!isInStock
                    ? 'Currently unavailable'
                    : lowStock
                      ? `Only ${visibleInventory} left`
                      : 'Available'}
                </p>
              )}

              {product.description || product.shortDescription ? (
                <p className="mt-4 text-sm leading-7 text-stone-600">
                  {product.shortDescription ?? product.description}
                </p>
              ) : null}
            </div>

            {product.variants.length ? (
              <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Variants
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {product.variants.map((variant) => {
                    const label =
                      variant.title ||
                      [variant.color, variant.size].filter(Boolean).join(' / ') ||
                      'Variant';

                    const active = selectedVariant?.id === variant.id;

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          active
                            ? 'border-stone-900 bg-stone-900 text-white'
                            : 'border-stone-300 bg-white text-stone-800 hover:border-stone-500'
                        }`}
                      >
                        <div className="font-medium">{label}</div>
                        <div className={`mt-1 text-xs ${active ? 'text-stone-200' : 'text-stone-500'}`}>
                          {variant.inventory > 0 ? `${variant.inventory} available` : 'Sold out'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Quantity
              </p>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  className="h-10 w-10 rounded-full border border-stone-300 bg-white text-lg"
                >
                  −
                </button>
                <div className="min-w-12 text-center text-base font-medium">{quantity}</div>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => value + 1)}
                  className="h-10 w-10 rounded-full border border-stone-300 bg-white text-lg"
                >
                  +
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!isInStock}
                  className="rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-300"
                >
                  {isInStock ? 'Add to Cart' : 'Sold Out'}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-stone-300 bg-white px-5 py-3 text-sm font-medium text-stone-900 transition hover:border-stone-500"
                >
                  Save to Wishlist
                </button>
              </div>

              {product.material || product.categoryName || product.stockVisibility ? (
                <dl className="mt-6 grid gap-3 text-sm text-stone-600">
                  {product.material ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">Material</dt>
                      <dd className="font-medium text-stone-900">{product.material}</dd>
                    </div>
                  ) : null}
                  {product.categoryName ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">Category</dt>
                      <dd className="font-medium text-stone-900">{product.categoryName}</dd>
                    </div>
                  ) : null}
                  {product.stockVisibility ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">Stock visibility</dt>
                      <dd className="font-medium text-stone-900">{product.stockVisibility}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <DetailSection
            title={product.storyTitle ?? 'Craft story'}
            content={product.storyBody ?? product.craftStory}
          />
          <DetailSection title="Artisan notes" content={product.artisanStory} />
          <DetailSection title="Care instructions" content={product.careInstructions} />
          <DetailSection title="Delivery & fulfilment" content={product.deliveryInfo} />
        </section>

        {Array.isArray(relatedProducts) && relatedProducts.length > 0 ? (
          <section className="mt-12">
            <div className="rounded-3xl border border-stone-200 bg-white p-6">
              <h2 className="text-xl font-semibold text-stone-900">Complete the look</h2>
              <p className="mt-2 text-sm text-stone-600">
                Related products are available from the API and can be wired into the existing
                product-card grid next.
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PDPInner />
    </Suspense>
  );
}
