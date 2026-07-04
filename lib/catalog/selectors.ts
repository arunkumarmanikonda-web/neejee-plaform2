import type { ProductReadModel } from './product-read';

export type CatalogueSelectorProduct = ProductReadModel & Record<string, any>;

export type CatalogueSelectorRequest = {
  products: CatalogueSelectorProduct[];
  categoryPath?: string | null;
  categorySlug?: string | null;
  campaignKey?: string | null;
  limit?: number;
};

export type CatalogueGalleryItem = {
  id: string | null;
  slug: string | null;
  sku: string | null;
  name: string | null;
  primaryImage: string | null;
  preferredImage: string | null;
  categoryPath: string | null;
  categorySlug: string | null;
  audienceTag: string | null;
  pinHero: boolean;
  featured: boolean;
  bestseller: boolean;
  editorial: boolean;
  exclude: boolean;
  inStock: boolean;
  imageApproved: boolean;
  imageQualityScore: number | null;
  effectivePrice: number | null;
  updatedAt: string | null;
};

export type CatalogueSelectionResult = {
  selectionKey: string;
  totalInput: number;
  totalMatched: number;
  totalEligible: number;
  excludedProductIds: string[];
  heroProduct: CatalogueSelectorProduct | null;
  orderedProducts: CatalogueSelectorProduct[];
  orderedGallery: CatalogueGalleryItem[];
};

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
    if (normalized === '1') return true;
    if (normalized === '0') return false;
  }
  return false;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toEpoch(value: unknown): number {
  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const dt = new Date(value);
    const ts = dt.getTime();
    return Number.isFinite(ts) ? ts : 0;
  }

  return 0;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter((item): item is string => !!item);
}

function getCategoryPath(product: CatalogueSelectorProduct): string | null {
  return (
    asString(product.categoryPath) ??
    asString(product.category?.path) ??
    asString(product.hierarchy?.path) ??
    null
  );
}

function getCategorySlug(product: CatalogueSelectorProduct): string | null {
  return (
    asString(product.categorySlug) ??
    asString(product.category?.slug) ??
    asString(product.leafCategory?.slug) ??
    asString(product.hierarchy?.leafCategory?.slug) ??
    null
  );
}

function getLineageSlugs(product: CatalogueSelectorProduct): string[] {
  const lineage = Array.isArray(product.hierarchy?.lineage)
    ? product.hierarchy.lineage
    : Array.isArray(product.category?.hierarchy?.lineage)
    ? product.category.hierarchy.lineage
    : [];

  return lineage
    .map((node: any) => asString(node?.slug))
    .filter((slug: string | null): slug is string => !!slug);
}

function getAudienceTag(product: CatalogueSelectorProduct): string | null {
  return (
    asString(product.catalogueAudienceTag) ??
    asString(product.catalogue?.audienceTag) ??
    asString(product.catalogueFlags?.audienceTag) ??
    asString(product.cta?.audienceTag) ??
    null
  );
}

function getBadges(product: CatalogueSelectorProduct): string[] {
  return toStringArray(product.badges);
}

function isExcluded(product: CatalogueSelectorProduct): boolean {
  return (
    asBoolean(product.catalogueExclude) ||
    asBoolean(product.catalogue?.exclude) ||
    asBoolean(product.catalogueFlags?.exclude)
  );
}

function isPinned(product: CatalogueSelectorProduct): boolean {
  return (
    asBoolean(product.cataloguePinHero) ||
    asBoolean(product.catalogue?.pinHero) ||
    asBoolean(product.catalogueFlags?.pinHero)
  );
}

function isFeatured(product: CatalogueSelectorProduct): boolean {
  return (
    asBoolean(product.catalogueFeatured) ||
    asBoolean(product.catalogue?.featured) ||
    asBoolean(product.catalogueFlags?.featured)
  );
}

function isBestseller(product: CatalogueSelectorProduct): boolean {
  return (
    asBoolean(product.catalogueBestseller) ||
    asBoolean(product.catalogue?.bestseller) ||
    asBoolean(product.catalogueFlags?.bestseller)
  );
}

function isEditorial(product: CatalogueSelectorProduct): boolean {
  return (
    asBoolean(product.catalogueEditorial) ||
    asBoolean(product.catalogue?.editorial) ||
    asBoolean(product.catalogueFlags?.editorial)
  );
}

function isInStock(product: CatalogueSelectorProduct): boolean {
  return (
    asBoolean(product.inStock) ||
    asBoolean(product.isInStock) ||
    asBoolean(product.stock?.inStock) ||
    (asNumber(product.inventory) ?? 0) > 0 ||
    (asNumber(product.stock?.totalInventory) ?? 0) > 0
  );
}

function isImageApproved(product: CatalogueSelectorProduct): boolean {
  return (
    asBoolean(product.catalogueImageApproved) ||
    asBoolean(product.catalogue?.imageApproved) ||
    asBoolean(product.media?.imageApproved)
  );
}

function getImageQualityScore(product: CatalogueSelectorProduct): number | null {
  return (
    asNumber(product.catalogueImageQualityScore) ??
    asNumber(product.catalogue?.imageQualityScore) ??
    asNumber(product.media?.imageQualityScore) ??
    null
  );
}

function getEffectivePrice(product: CatalogueSelectorProduct): number | null {
  return (
    asNumber(product.pricing?.effectivePrice) ??
    asNumber(product.salePrice) ??
    asNumber(product.sellingPrice) ??
    asNumber(product.mrp) ??
    null
  );
}

function getUpdatedAt(product: CatalogueSelectorProduct): number {
  return (
    toEpoch(product.updatedAt) ||
    toEpoch(product.timestamps?.updatedAt) ||
    toEpoch(product.createdAt) ||
    toEpoch(product.timestamps?.createdAt)
  );
}

function getPrimaryImage(product: CatalogueSelectorProduct): string | null {
  return (
    asString(product.primaryImage) ??
    asString(product.image) ??
    asString(product.media?.primaryImage) ??
    null
  );
}

function getPreferredImage(product: CatalogueSelectorProduct): string | null {
  return (
    asString(product.cataloguePreferredImage) ??
    asString(product.catalogue?.preferredImage) ??
    asString(product.media?.preferredImage) ??
    null
  );
}

function getSelectionScore(product: CatalogueSelectorProduct): string {
  return [
    isPinned(product) ? '1' : '0',
    isFeatured(product) ? '1' : '0',
    isBestseller(product) ? '1' : '0',
    isEditorial(product) ? '1' : '0',
    isImageApproved(product) ? '1' : '0',
    isInStock(product) ? '1' : '0',
    String(getImageQualityScore(product) ?? 0).padStart(4, '0'),
    String(getUpdatedAt(product)).padStart(16, '0'),
    asString(product.slug) ?? '',
    asString(product.id) ?? '',
  ].join('|');
}

function compareProducts(
  a: CatalogueSelectorProduct,
  b: CatalogueSelectorProduct
): number {
  const boolDesc = (left: boolean, right: boolean) => {
    if (left === right) return 0;
    return left ? -1 : 1;
  };

  const numberDesc = (left: number | null, right: number | null) => {
    const l = left ?? -1;
    const r = right ?? -1;
    if (l === r) return 0;
    return l > r ? -1 : 1;
  };

  const numberAsc = (left: number | null, right: number | null) => {
    const l = left ?? Number.MAX_SAFE_INTEGER;
    const r = right ?? Number.MAX_SAFE_INTEGER;
    if (l === r) return 0;
    return l < r ? -1 : 1;
  };

  const stringAsc = (left: string | null, right: string | null) => {
    const l = left ?? '';
    const r = right ?? '';
    return l.localeCompare(r);
  };

  return (
    boolDesc(isPinned(a), isPinned(b)) ||
    boolDesc(isFeatured(a), isFeatured(b)) ||
    boolDesc(isBestseller(a), isBestseller(b)) ||
    boolDesc(isEditorial(a), isEditorial(b)) ||
    boolDesc(isImageApproved(a), isImageApproved(b)) ||
    boolDesc(isInStock(a), isInStock(b)) ||
    numberDesc(getImageQualityScore(a), getImageQualityScore(b)) ||
    numberDesc(getUpdatedAt(a), getUpdatedAt(b)) ||
    numberAsc(getEffectivePrice(a), getEffectivePrice(b)) ||
    stringAsc(asString(a.slug), asString(b.slug)) ||
    stringAsc(asString(a.id), asString(b.id))
  );
}

function matchesCategory(
  product: CatalogueSelectorProduct,
  categoryPath?: string | null,
  categorySlug?: string | null
): boolean {
  const normalizedPath = asString(categoryPath);
  const normalizedSlug = asString(categorySlug);

  if (!normalizedPath && !normalizedSlug) return true;

  const productPath = getCategoryPath(product);
  const productSlug = getCategorySlug(product);
  const lineageSlugs = getLineageSlugs(product);

  const pathMatch = normalizedPath
    ? productPath === normalizedPath ||
      (!!productPath && productPath.startsWith(`${normalizedPath}/`))
    : true;

  const slugMatch = normalizedSlug
    ? productSlug === normalizedSlug || lineageSlugs.includes(normalizedSlug)
    : true;

  return pathMatch && slugMatch;
}

function matchesCampaign(
  product: CatalogueSelectorProduct,
  campaignKey?: string | null
): boolean {
  const key = asString(campaignKey)?.toLowerCase();
  if (!key) return true;

  const audienceTag = getAudienceTag(product)?.toLowerCase();
  const badges = getBadges(product).map((badge) => badge.toLowerCase());

  return audienceTag === key || badges.includes(key);
}

function toGalleryItem(product: CatalogueSelectorProduct): CatalogueGalleryItem {
  return {
    id: asString(product.id),
    slug: asString(product.slug),
    sku: asString(product.sku),
    name:
      asString(product.identity?.name) ??
      asString(product.name) ??
      asString(product.title) ??
      null,
    primaryImage: getPrimaryImage(product),
    preferredImage: getPreferredImage(product),
    categoryPath: getCategoryPath(product),
    categorySlug: getCategorySlug(product),
    audienceTag: getAudienceTag(product),
    pinHero: isPinned(product),
    featured: isFeatured(product),
    bestseller: isBestseller(product),
    editorial: isEditorial(product),
    exclude: isExcluded(product),
    inStock: isInStock(product),
    imageApproved: isImageApproved(product),
    imageQualityScore: getImageQualityScore(product),
    effectivePrice: getEffectivePrice(product),
    updatedAt:
      asString(product.updatedAt) ??
      asString(product.timestamps?.updatedAt) ??
      null,
  };
}

export function selectCatalogueProducts(
  request: CatalogueSelectorRequest
): CatalogueSelectionResult {
  const products = Array.isArray(request.products) ? request.products : [];
  const limit =
    typeof request.limit === 'number' && Number.isFinite(request.limit) && request.limit > 0
      ? Math.floor(request.limit)
      : products.length || 0;

  const matched = products.filter((product) => {
    return (
      matchesCategory(product, request.categoryPath, request.categorySlug) &&
      matchesCampaign(product, request.campaignKey)
    );
  });

  const excludedProductIds = matched
    .filter((product) => isExcluded(product))
    .map((product) => asString(product.id))
    .filter((id): id is string => !!id);

  const eligible = matched
    .filter((product) => !isExcluded(product))
    .slice()
    .sort(compareProducts);

  const orderedProducts = eligible.slice(0, limit);

  const pinned = eligible.filter((product) => isPinned(product));
  const heroProduct = (pinned.length > 0 ? pinned : eligible)[0] ?? null;

  return {
    selectionKey: [
      asString(request.categoryPath) ?? '',
      asString(request.categorySlug) ?? '',
      asString(request.campaignKey) ?? '',
      String(limit),
    ].join('|'),
    totalInput: products.length,
    totalMatched: matched.length,
    totalEligible: eligible.length,
    excludedProductIds,
    heroProduct,
    orderedProducts,
    orderedGallery: orderedProducts.map(toGalleryItem),
  };
}

export function selectHeroProduct(
  products: CatalogueSelectorProduct[],
  options?: Omit<CatalogueSelectorRequest, 'products' | 'limit'>
): CatalogueSelectorProduct | null {
  return selectCatalogueProducts({
    products,
    categoryPath: options?.categoryPath ?? null,
    categorySlug: options?.categorySlug ?? null,
    campaignKey: options?.campaignKey ?? null,
    limit: 1,
  }).heroProduct;
}

export function orderCatalogueGallery(
  products: CatalogueSelectorProduct[],
  options?: Omit<CatalogueSelectorRequest, 'products'>
): CatalogueGalleryItem[] {
  return selectCatalogueProducts({
    products,
    categoryPath: options?.categoryPath ?? null,
    categorySlug: options?.categorySlug ?? null,
    campaignKey: options?.campaignKey ?? null,
    limit: options?.limit,
  }).orderedGallery;
}
