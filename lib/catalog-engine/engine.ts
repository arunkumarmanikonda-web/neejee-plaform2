import type { ProductReadModel } from '../catalog/contracts';
import {
  DEFAULT_PREMIUM_CATALOGUE_FEATURED_LIMIT,
  PREMIUM_CATALOGUE_ENGINE_VERSION,
  type PremiumCatalogueEngineBrief,
  type PremiumCatalogueEngineOutput,
  type PremiumCatalogueEngineRequest,
  type PremiumCatalogueEngineNormalizedBrief,
  type PremiumCatalogueGalleryItem,
  type PremiumCatalogueMerchandisingSummary,
  type PremiumCatalogueSection,
  type PremiumCatalogueTone,
} from './contracts';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function toTimestamp(value: unknown): number | null {
  const iso = toIsoString(value);
  return iso ? Date.parse(iso) : null;
}

function uniqueSortedStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort(
    (a, b) => a.localeCompare(b)
  );
}

function splitTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueSortedStrings(value.flatMap(item => splitTokens(item)));
  }

  if (typeof value !== "string") return [];

  return uniqueSortedStrings(
    value
      .split(/[|,/]/g)
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => item.toUpperCase())
  );
}

function rawProduct(product: ProductReadModel): Record<string, unknown> {
  return product as unknown as Record<string, unknown>;
}

function getProductId(product: ProductReadModel): string {
  const raw = rawProduct(product);
  return asString(raw.id) ?? asString(raw.slug) ?? asString(raw.sku) ?? 'unknown-product';
}

function getProductSlug(product: ProductReadModel): string | null {
  return asString(rawProduct(product).slug);
}

function getProductSku(product: ProductReadModel): string | null {
  return asString(rawProduct(product).sku);
}

function getIdentityKey(product: ProductReadModel): string {
  return [getProductId(product), getProductSlug(product) ?? '', getProductSku(product) ?? ''].join(
    '::'
  );
}

function dedupeProducts(products: ProductReadModel[]): ProductReadModel[] {
  const seen = new Set<string>();
  const result: ProductReadModel[] = [];

  for (const product of products) {
    const key = getIdentityKey(product);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(product);
  }

  return result;
}

function getCatalogueRecord(product: ProductReadModel): Record<string, unknown> | null {
  const raw = rawProduct(product);
  return asRecord(raw.catalogue) ?? asRecord(raw.catalogueFlags);
}

function getMediaRecord(product: ProductReadModel): Record<string, unknown> | null {
  return asRecord(rawProduct(product).media);
}

function getStockRecord(product: ProductReadModel): Record<string, unknown> | null {
  return asRecord(rawProduct(product).stock);
}

function getPricingRecord(product: ProductReadModel): Record<string, unknown> | null {
  return asRecord(rawProduct(product).pricing);
}

function getTimestampsRecord(product: ProductReadModel): Record<string, unknown> | null {
  return asRecord(rawProduct(product).timestamps);
}

function isPinned(product: ProductReadModel): boolean {
  const raw = rawProduct(product);
  const catalogue = getCatalogueRecord(product);

  return Boolean(asBoolean(raw.cataloguePinHero) ?? asBoolean(catalogue?.pinHero) ?? false);
}

function isFeatured(product: ProductReadModel): boolean {
  const raw = rawProduct(product);
  const catalogue = getCatalogueRecord(product);

  return Boolean(asBoolean(raw.catalogueFeatured) ?? asBoolean(catalogue?.featured) ?? false);
}

function isBestseller(product: ProductReadModel): boolean {
  const raw = rawProduct(product);
  const catalogue = getCatalogueRecord(product);

  return Boolean(asBoolean(raw.catalogueBestseller) ?? asBoolean(catalogue?.bestseller) ?? false);
}

function isEditorial(product: ProductReadModel): boolean {
  const raw = rawProduct(product);
  const catalogue = getCatalogueRecord(product);

  return Boolean(asBoolean(raw.catalogueEditorial) ?? asBoolean(catalogue?.editorial) ?? false);
}

function isExcluded(product: ProductReadModel): boolean {
  const raw = rawProduct(product);
  const catalogue = getCatalogueRecord(product);

  return Boolean(asBoolean(raw.catalogueExclude) ?? asBoolean(catalogue?.exclude) ?? false);
}

function isImageApproved(product: ProductReadModel): boolean {
  const raw = rawProduct(product);
  const media = getMediaRecord(product);

  return Boolean(asBoolean(raw.catalogueImageApproved) ?? asBoolean(media?.imageApproved) ?? false);
}

function getImageQualityScore(product: ProductReadModel): number | null {
  const raw = rawProduct(product);
  const media = getMediaRecord(product);

  return asNumber(raw.catalogueImageQualityScore) ?? asNumber(media?.imageQualityScore) ?? null;
}

function isInStock(product: ProductReadModel): boolean {
  const stock = getStockRecord(product);
  return Boolean(asBoolean(stock?.inStock) ?? false);
}

function getEffectivePrice(product: ProductReadModel): number | null {
  const pricing = getPricingRecord(product);

  return (
    asNumber(pricing?.effectivePrice) ??
    asNumber(pricing?.salePrice) ??
    asNumber(pricing?.sellingPrice) ??
    asNumber(pricing?.mrp) ??
    null
  );
}

function getUpdatedTimestamp(product: ProductReadModel): number {
  const raw = rawProduct(product);
  const timestamps = getTimestampsRecord(product);

  return (
    toTimestamp(timestamps?.updatedAt) ??
    toTimestamp(raw.updatedAt) ??
    toTimestamp(timestamps?.createdAt) ??
    toTimestamp(raw.createdAt) ??
    0
  );
}

function getUpdatedIso(product: ProductReadModel): string | null {
  const raw = rawProduct(product);
  const timestamps = getTimestampsRecord(product);

  return (
    toIsoString(timestamps?.updatedAt) ??
    toIsoString(raw.updatedAt) ??
    toIsoString(timestamps?.createdAt) ??
    toIsoString(raw.createdAt)
  );
}

function getPrimaryImage(product: ProductReadModel): string | null {
  const raw = rawProduct(product);
  const media = getMediaRecord(product);

  return (
    asString(raw.primaryImage) ??
    asString(raw.image) ??
    asString(media?.primaryImage) ??
    asString(media?.preferredImage) ??
    asString(raw.cataloguePreferredImage) ??
    null
  );
}

function getAudienceTokens(product: ProductReadModel): string[] {
  const raw = rawProduct(product);
  const catalogue = getCatalogueRecord(product);

  const rawBadges = Array.isArray(raw.badges) ? raw.badges : [];
  const badgeTokens = rawBadges.flatMap(badge => {
    if (typeof badge === 'string') return splitTokens(badge);
    const badgeRecord = asRecord(badge);
    if (!badgeRecord) return [];
    return splitTokens(
      asString(badgeRecord.label) ?? asString(badgeRecord.slug) ?? asString(badgeRecord.name)
    );
  });

  return uniqueSortedStrings([
    ...splitTokens(raw.catalogueAudienceTag),
    ...splitTokens(catalogue?.audienceTag),
    ...splitTokens(raw.tags),
    ...splitTokens(raw.labels),
    ...badgeTokens,
  ]);
}

function matchesAudience(product: ProductReadModel, audienceTags: string[]): boolean {
  if (audienceTags.length === 0) return true;
  const tokens = new Set(getAudienceTokens(product));
  return audienceTags.some(tag => tokens.has(tag));
}

function sortProductsDeterministically(products: ProductReadModel[]): ProductReadModel[] {
  const boolRank = (a: boolean, b: boolean) => Number(b) - Number(a);
  const numberDesc = (a: number | null, b: number | null) => (b ?? -Infinity) - (a ?? -Infinity);
  const numberAsc = (a: number | null, b: number | null) => (a ?? Infinity) - (b ?? Infinity);
  const stringAsc = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');

  return [...products].sort((a, b) => {
    return (
      boolRank(isPinned(a), isPinned(b)) ||
      boolRank(isFeatured(a), isFeatured(b)) ||
      boolRank(isBestseller(a), isBestseller(b)) ||
      boolRank(isEditorial(a), isEditorial(b)) ||
      boolRank(isImageApproved(a), isImageApproved(b)) ||
      boolRank(isInStock(a), isInStock(b)) ||
      numberDesc(getImageQualityScore(a), getImageQualityScore(b)) ||
      numberDesc(getUpdatedTimestamp(a), getUpdatedTimestamp(b)) ||
      numberAsc(getEffectivePrice(a), getEffectivePrice(b)) ||
      stringAsc(getProductSlug(a), getProductSlug(b)) ||
      stringAsc(getProductId(a), getProductId(b))
    );
  });
}

function normalizeTone(value: unknown): PremiumCatalogueTone {
  switch (value) {
    case 'luxury':
    case 'editorial':
    case 'gifting':
    case 'seasonal':
    case 'evergreen':
      return value;
    default:
      return 'luxury';
  }
}

export function normalizePremiumCatalogueBrief(
  brief: PremiumCatalogueEngineBrief
): PremiumCatalogueEngineNormalizedBrief {
  const featuredLimit =
    typeof brief.featuredLimit === 'number' && Number.isFinite(brief.featuredLimit)
      ? Math.max(1, Math.floor(brief.featuredLimit))
      : DEFAULT_PREMIUM_CATALOGUE_FEATURED_LIMIT;

  return {
    id: asString(brief.id),
    slug: asString(brief.slug),
    title: asString(brief.title),
    tone: normalizeTone(brief.tone),
    featuredLimit,
    includeProductIds: uniqueSortedStrings((brief.includeProductIds ?? []).map(item => asString(item))),
    excludeProductIds: uniqueSortedStrings((brief.excludeProductIds ?? []).map(item => asString(item))),
    audienceTags: uniqueSortedStrings(
      (brief.audienceTags ?? []).flatMap(item => splitTokens(item))
    ),
    generatedAt: toIsoString(brief.generatedAt),
  };
}

function filterProductsForBrief(
  products: ProductReadModel[],
  brief: PremiumCatalogueEngineNormalizedBrief
): ProductReadModel[] {
  const includeSet = new Set(brief.includeProductIds);
  const excludeSet = new Set(brief.excludeProductIds);

  return dedupeProducts(products).filter(product => {
    const id = getProductId(product);
    const slug = getProductSlug(product);
    const sku = getProductSku(product);

    const identities = [id, slug, sku].filter((value): value is string => Boolean(value));

    const includePass =
      includeSet.size === 0 || identities.some(value => includeSet.has(value));

    if (!includePass) return false;
    if (identities.some(value => excludeSet.has(value))) return false;
    if (!matchesAudience(product, brief.audienceTags)) return false;

    return true;
  });
}

function deriveGeneratedAt(explicitGeneratedAt: string | null, products: ProductReadModel[]): string {
  if (explicitGeneratedAt) return explicitGeneratedAt;

  const maxTimestamp = products.reduce((max, product) => {
    return Math.max(max, getUpdatedTimestamp(product));
  }, 0);

  if (maxTimestamp > 0) {
    return new Date(maxTimestamp).toISOString();
  }

  return new Date('2026-01-01T00:00:00.000Z').toISOString();
}

function buildSelectionKey(brief: PremiumCatalogueEngineNormalizedBrief): string {
  return [
    brief.id ?? '',
    brief.slug ?? '',
    brief.title ?? '',
    brief.tone,
    String(brief.featuredLimit),
    brief.includeProductIds.join(','),
    brief.excludeProductIds.join(','),
    brief.audienceTags.join(','),
  ].join('|');
}

function buildGallery(products: ProductReadModel[]): PremiumCatalogueGalleryItem[] {
  return products.map(product => ({
    productId: getProductId(product),
    slug: getProductSlug(product),
    primaryImage: getPrimaryImage(product),
    approved: isImageApproved(product),
    qualityScore: getImageQualityScore(product),
    pinHero: isPinned(product),
    featured: isFeatured(product),
    bestseller: isBestseller(product),
    editorial: isEditorial(product),
    inStock: isInStock(product),
    effectivePrice: getEffectivePrice(product),
    updatedAt: getUpdatedIso(product),
  }));
}

function buildSections(
  heroProduct: ProductReadModel | null,
  orderedProducts: ProductReadModel[],
  featuredLimit: number
): PremiumCatalogueSection[] {
  const sections: PremiumCatalogueSection[] = [];

  if (heroProduct) {
    sections.push({
      kind: 'hero',
      title: 'Hero',
      productIds: [getProductId(heroProduct)],
      products: [heroProduct],
    });
  }

  const heroId = heroProduct ? getProductId(heroProduct) : null;
  const remaining = orderedProducts.filter(product => getProductId(product) !== heroId);
  const featuredProducts = remaining.slice(0, featuredLimit);
  const gridProducts = remaining.slice(featuredLimit);

  if (featuredProducts.length > 0) {
    sections.push({
      kind: 'featured',
      title: 'Featured',
      productIds: featuredProducts.map(getProductId),
      products: featuredProducts,
    });
  }

  if (gridProducts.length > 0) {
    sections.push({
      kind: 'grid',
      title: 'Catalogue',
      productIds: gridProducts.map(getProductId),
      products: gridProducts,
    });
  }

  return sections;
}

function buildMerchandisingSummary(
  tone: PremiumCatalogueTone,
  featuredLimit: number,
  matchedProducts: ProductReadModel[],
  eligibleProducts: ProductReadModel[]
): PremiumCatalogueMerchandisingSummary {
  return {
    tone,
    featuredLimit,
    includedCount: eligibleProducts.length,
    excludedCount: matchedProducts.length - eligibleProducts.length,
    inStockCount: eligibleProducts.filter(isInStock).length,
    approvedImageCount: eligibleProducts.filter(isImageApproved).length,
    pinnedCount: eligibleProducts.filter(isPinned).length,
    featuredCount: eligibleProducts.filter(isFeatured).length,
    bestsellerCount: eligibleProducts.filter(isBestseller).length,
    editorialCount: eligibleProducts.filter(isEditorial).length,
  };
}

export function buildPremiumCatalogueEngine(
  request: PremiumCatalogueEngineRequest
): PremiumCatalogueEngineOutput {
  const brief = normalizePremiumCatalogueBrief(request.brief);
  const totalInput = request.products.length;

  const matchedProducts = filterProductsForBrief(request.products, brief);
  const excludedMatchedProducts = matchedProducts.filter(isExcluded);
  const eligibleProducts = matchedProducts.filter(product => !isExcluded(product));
  const orderedProducts = sortProductsDeterministically(eligibleProducts);

  const heroProduct =
    orderedProducts.find(product => isPinned(product)) ??
    orderedProducts[0] ??
    null;

  return {
    version: PREMIUM_CATALOGUE_ENGINE_VERSION,
    generatedAt: deriveGeneratedAt(brief.generatedAt, orderedProducts),
    brief,
    selection: {
      selectionKey: buildSelectionKey(brief),
      totalInput,
      totalMatched: matchedProducts.length,
      totalEligible: eligibleProducts.length,
      includedProductIds: matchedProducts.map(getProductId),
      excludedProductIds: excludedMatchedProducts.map(getProductId),
      orderedProductIds: orderedProducts.map(getProductId),
      heroProductId: heroProduct ? getProductId(heroProduct) : null,
    },
    merchandising: buildMerchandisingSummary(
      brief.tone,
      brief.featuredLimit,
      matchedProducts,
      eligibleProducts
    ),
    heroProduct,
    gallery: buildGallery(orderedProducts),
    sections: buildSections(heroProduct, orderedProducts, brief.featuredLimit),
    products: orderedProducts,
  };
}
