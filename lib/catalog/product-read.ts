import {
  buildBadges as buildBadgesCore,
  type ProductBadgeSourceRow,
  type ProductReadBadge,
} from './badges-read';
import {
  buildCatalogueFlags as buildCatalogueFlagsCore,
  buildCatalogueReadiness as buildCatalogueReadinessCore,
  type CatalogueCurationSourceRow,
} from './catalogue-curation';
import {
  buildHierarchy as buildHierarchyCore,
  buildCategoryBreadcrumbs as buildCategoryBreadcrumbsCore,
  type ProductHierarchySource,
} from './hierarchy-read';
import {
  resolveMedia as resolveMediaCore,
  type MediaReadSourceRow,
} from './media-read';
import { buildPricing as buildPricingCore } from './pricing-read';
import {
  deriveStock as deriveStockCore,
  normalizeStockVisibility as normalizeStockVisibilityCore,
} from './stock-visibility';

type UnknownRecord = Record<string, unknown>;

export type ProductReadSaleWindow = {
  startsAt: string | null;
  endsAt: string | null;
  startAt: string | null;
  endAt: string | null;
  active: boolean | null;
  [key: string]: any;
};

export type ProductReadPricing = {
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  effectivePrice: number;
  discountAmount: number;
  discountPercent: number;
  onSale: boolean;
  saleWindow: ProductReadSaleWindow;
  gstRate: number | null;
  hsnCode: string | null;
  currency: string;
  [key: string]: any;
};

export type ProductReadStock = {
  inStock: boolean;
  totalInventory: number;
  lowStock: boolean;
  stockVisibility: string;
  label: string | null;
  [key: string]: any;
};

export type ProductReadAi = {
  tryOnEligible: boolean;
  roomEligible: boolean;
  arTryOnEligible: boolean;
  arEligible: boolean;
  mirrorEligible: boolean;
  [key: string]: any;
};

export type ProductReadPolicies = {
  codEligible: boolean;
  returnEligible: boolean;
  returnPolicy: string | null;
  [key: string]: any;
};

export type ProductReadCta = {
  mode: string | null;
  audienceTag: string | null;
  storyBlock: string | null;
  [key: string]: any;
};

export type ProductReadTimestamps = {
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
};

export type ProductReadIdentity = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  title: string;
  shortName: string;
  poeticLine: string | null;
  status: string;
  active: boolean;
  enabled: boolean;
  published: boolean;
  [key: string]: any;
};

export type ProductReadCatalogue = {
  featured: boolean;
  bestseller: boolean;
  editorial: boolean;
  pinHero: boolean;
  exclude: boolean;
  audienceTag: string | null;
  ctaMode: string | null;
  mode: string | null;
  storyBlock: string | null;
  preferredImage: string | null;
  imageApproved: boolean;
  imageQualityScore: number | null;
  stockVisibility: string;
  cta: ProductReadCta;
  readiness: Record<string, any>;
  [key: string]: any;
};

export type ProductReadHierarchyNode = {
  id: string | null;
  slug: string | null;
  name: string | null;
  path: string | null;
  depth: number | null;
  [key: string]: any;
};

export type ProductReadHierarchy = {
  path: string | null;
  depth: number;
  lineage: ProductReadHierarchyNode[];
  mainCategory: any;
  subCategory: any;
  subSubCategory: any;
  leafCategory: any;
  [key: string]: any;
};

export type ProductReadCategory = {
  path: string | null;
  level: number;
  breadcrumb: string[];
  breadcrumbs: Array<Record<string, any>>;
  hierarchy: ProductReadHierarchy;
  mainCategory: any;
  subCategory: any;
  subSubCategory: any;
  leafCategory: any;
  name: string | null;
  [key: string]: any;
};

export type ProductReadCategorySource = ProductHierarchySource & {
  category?: unknown;
  categoryPath?: unknown;
  mainCategory?: unknown;
  subCategory?: unknown;
  subSubCategory?: unknown;
  leafCategory?: unknown;
};

export type ProductReadVariantSource = ProductBadgeSourceRow &
  CatalogueCurationSourceRow &
  Partial<MediaReadSourceRow> &
  Partial<ProductReadCategorySource> & {
    id?: unknown;
    slug?: unknown;
    handle?: unknown;
    sku?: unknown;
    name?: unknown;
    title?: unknown;
    shortName?: unknown;
    poeticLine?: unknown;
    label?: unknown;
    description?: unknown;
    shortDescription?: unknown;
    excerpt?: unknown;
    summary?: unknown;
    image?: unknown;
    images?: unknown;
    gallery?: unknown;
    productImages?: unknown;
    variantImages?: unknown;
    color?: unknown;
    material?: unknown;
    finish?: unknown;
    size?: unknown;
    active?: unknown;
    enabled?: unknown;
    status?: unknown;
    published?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    aiTryOnEligible?: unknown;
    tryOnEligible?: unknown;
    aiRoomEligible?: unknown;
    roomEligible?: unknown;
    arTryOnEligible?: unknown;
    arEligible?: unknown;
    mirrorEligible?: unknown;
    codEligible?: unknown;
    returnEligible?: unknown;
    returnPolicy?: unknown;
    ctaMode?: unknown;
    audienceTag?: unknown;
    storyBlock?: unknown;
    catalogueCtaMode?: unknown;
    catalogueAudienceTag?: unknown;
    catalogueStoryBlock?: unknown;
    [key: string]: unknown;
  };

export type ProductReadSourceRow = ProductBadgeSourceRow &
  CatalogueCurationSourceRow &
  ProductReadCategorySource &
  Partial<MediaReadSourceRow> & {
    id?: unknown;
    slug?: unknown;
    handle?: unknown;
    sku?: unknown;
    name?: unknown;
    title?: unknown;
    shortName?: unknown;
    poeticLine?: unknown;
    label?: unknown;
    description?: unknown;
    shortDescription?: unknown;
    excerpt?: unknown;
    summary?: unknown;
    region?: unknown;
    origin?: unknown;
    image?: unknown;
    images?: unknown;
    gallery?: unknown;
    productImages?: unknown;
    variantImages?: unknown;
    tags?: unknown;
    labels?: unknown;
    status?: unknown;
    active?: unknown;
    enabled?: unknown;
    published?: unknown;
    metaTitle?: unknown;
    metaDescription?: unknown;
    variants?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    aiTryOnEligible?: unknown;
    tryOnEligible?: unknown;
    aiRoomEligible?: unknown;
    roomEligible?: unknown;
    arTryOnEligible?: unknown;
    arEligible?: unknown;
    mirrorEligible?: unknown;
    codEligible?: unknown;
    returnEligible?: unknown;
    returnPolicy?: unknown;
    ctaMode?: unknown;
    audienceTag?: unknown;
    storyBlock?: unknown;
    catalogueCtaMode?: unknown;
    catalogueAudienceTag?: unknown;
    catalogueStoryBlock?: unknown;
    [key: string]: unknown;
  };

export type ProductReadVariant = {
  id: string | null;
  slug: string | null;
  sku: string | null;
  name: string | null;
  description: string | null;
  color: string | null;
  material: string | null;
  finish: string | null;
  size: string | null;
  active: boolean;
  identity: ProductReadIdentity;
  pricing: ProductReadPricing;
  stock: ProductReadStock;
  catalogue: ProductReadCatalogue;
  badges: ProductReadBadge[];
  primaryImage: string | null;
  gallery: string[];
  productImages: string[];
  variantImages: string[];
  media: Record<string, any>;
  timestamps: ProductReadTimestamps;
  [key: string]: any;
};

export type ProductReadModel = {
  id: string | null;
  slug: string | null;
  sku: string | null;
  name: string | null;
  title: string | null;
  description: string | null;
  shortDescription: string | null;
  excerpt: string | null;
  summary: string | null;
  region: string | null;
  origin: string | null;
  status: string | null;
  active: boolean;
  enabled: boolean;
  published: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  identity: ProductReadIdentity;

  ai: ProductReadAi;
  aiTryOnEligible: boolean;
  aiRoomEligible: boolean;
  arTryOnEligible: boolean;
  arEligible: boolean;
  mirrorEligible: boolean;

  policies: ProductReadPolicies;
  purchase: ProductReadPolicies;
  commerce: ProductReadPolicies;
  codEligible: boolean;
  returnEligible: boolean;
  returnPolicy: string | null;

  cta: ProductReadCta;
  catalogueCta: ProductReadCta;

  category: ProductReadCategory;
  tags: string[];
  labels: string[];
  primaryImage: string | null;
  image: string | null;
  images: string[];
  gallery: string[];
  productImages: string[];
  variantImages: string[];
  media: Record<string, any>;
  pricing: ProductReadPricing;
  stock: ProductReadStock;
  catalogue: ProductReadCatalogue;
  badges: ProductReadBadge[];
  hierarchy: ProductReadHierarchy;
  categoryPath: string | null;
  categoryLevel: number;
  categoryBreadcrumb: string[];
  breadcrumbs: Array<Record<string, any>>;
  mainCategory: any;
  subCategory: any;
  subSubCategory: any;
  leafCategory: any;

  catalogueFlags: {
    featured: boolean;
    bestseller: boolean;
    editorial: boolean;
    pinHero: boolean;
    exclude: boolean;
    audienceTag: string | null;
    ctaMode: string | null;
    storyBlock: string | null;
  };

  catalogueFeatured: boolean;
  catalogueBestseller: boolean;
  catalogueEditorial: boolean;
  cataloguePinHero: boolean;
  catalogueExclude: boolean;
  cataloguePreferredImage: string | null;
  catalogueAudienceTag: string | null;
  catalogueCtaMode: string | null;
  catalogueStoryBlock: string | null;
  catalogueImageApproved: boolean;
  catalogueImageQualityScore: number | null;
  catalogueStockVisibility: string;
  catalogueReadiness: Record<string, any>;

  variants: ProductReadVariant[];
  createdAt: Date | null;
  updatedAt: Date | null;
  timestamps: ProductReadTimestamps;
  [key: string]: any;
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function getStringFromRecord(value: unknown, keys: string[]): string | null {
  if (!isRecord(value)) return null;
  for (const key of keys) {
    const resolved = asString(value[key]);
    if (resolved) return resolved;
  }
  return null;
}

export function toStringArray(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === 'string') return [item];
        if (isRecord(item)) {
          const resolved = getStringFromRecord(item, [
            'label',
            'name',
            'title',
            'slug',
            'url',
          ]);
          return resolved ? [resolved] : [];
        }
        return [];
      })
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

export function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function toRecordArray<T extends UnknownRecord>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord) as T[];
}

function pickName(source: UnknownRecord): string | null {
  return (
    asString(source.name) ??
    asString(source.title) ??
    asString(source.label) ??
    asString(source.productName) ??
    asString(source.displayName)
  );
}

function pickDescription(source: UnknownRecord): string | null {
  return (
    asString(source.description) ??
    asString(source.shortDescription) ??
    asString(source.excerpt) ??
    asString(source.summary)
  );
}

function normalizeSaleWindow(value: unknown): ProductReadSaleWindow {
  const record = isRecord(value) ? value : {};

  const startsAt =
    asString(record.startsAt) ??
    asString(record.startAt) ??
    null;

  const endsAt =
    asString(record.endsAt) ??
    asString(record.endAt) ??
    null;

  return {
    ...record,
    startsAt,
    endsAt,
    startAt: startsAt,
    endAt: endsAt,
    active: asBoolean(record.active),
  };
}

function normalizePricing(pricing: unknown): ProductReadPricing {
  const record = isRecord(pricing) ? pricing : {};

  const mrp = asNumber(record.mrp);
  const sellingPrice = asNumber(record.sellingPrice);
  const salePrice = asNumber(record.salePrice);
  const effectivePrice =
    asNumber(record.effectivePrice) ??
    salePrice ??
    sellingPrice ??
    mrp ??
    0;
  const discountAmount =
    asNumber(record.discountAmount) ??
    (mrp != null ? Math.max(0, mrp - effectivePrice) : 0);
  const discountPercent =
    asNumber(record.discountPercent) ??
    (mrp && mrp > 0 ? Math.round((discountAmount / mrp) * 100) : 0);

  return {
    ...record,
    mrp,
    sellingPrice,
    salePrice,
    effectivePrice,
    discountAmount,
    discountPercent,
    onSale: asBoolean(record.onSale) ?? false,
    saleWindow: normalizeSaleWindow(record.saleWindow),
    gstRate: asNumber(record.gstRate),
    hsnCode: asString(record.hsnCode),
    currency: asString(record.currency) ?? 'INR',
  };
}

function normalizeStock(stock: unknown): ProductReadStock {
  const record = isRecord(stock) ? stock : {};
  const totalInventory =
    asNumber(record.totalInventory) ??
    asNumber(record.inventory) ??
    asNumber(record.stockOnHand) ??
    0;

  return {
    ...record,
    inStock: asBoolean(record.inStock) ?? totalInventory > 0,
    totalInventory,
    lowStock: asBoolean(record.lowStock) ?? (totalInventory > 0 && totalInventory <= 2),
    stockVisibility:
      asString(record.stockVisibility) ??
      normalizeStockVisibilityCore(record.stockVisibility) ??
      'IN_STOCK_ONLY',
    label: asString(record.label) ?? (totalInventory > 0 ? 'In stock' : 'Out of stock'),
  };
}

function normalizeMediaPayload(media: unknown, source: UnknownRecord) {
  const mediaRecord = isRecord(media) ? media : {};

  const primaryImage =
    asString(mediaRecord.primaryImage) ??
    asString(source.primaryImage) ??
    asString(source.image) ??
    toStringArray(source.images)[0] ??
    null;

  const gallery = dedupeStrings([
    ...toStringArray(mediaRecord.gallery),
    ...toStringArray(source.gallery),
    ...toStringArray(source.images),
    ...toStringArray(source.productImages),
  ]);

  const productImages = dedupeStrings([
    ...toStringArray(mediaRecord.productImages),
    ...toStringArray(source.productImages),
    ...gallery,
  ]);

  const variantImages = dedupeStrings([
    ...toStringArray(mediaRecord.variantImages),
    ...toStringArray(source.variantImages),
  ]);

  return {
    ...mediaRecord,
    primaryImage,
    gallery,
    productImages,
    variantImages,
  };
}

function normalizeCatalogueFlags(flags: unknown) {
  const record = isRecord(flags) ? flags : {};

  return {
    featured:
      asBoolean(record.featured) ??
      asBoolean(record.catalogueFeatured) ??
      false,
    bestseller:
      asBoolean(record.bestseller) ??
      asBoolean(record.catalogueBestseller) ??
      false,
    editorial:
      asBoolean(record.editorial) ??
      asBoolean(record.catalogueEditorial) ??
      false,
    pinHero:
      asBoolean(record.pinHero) ??
      asBoolean(record.cataloguePinHero) ??
      false,
    exclude:
      asBoolean(record.exclude) ??
      asBoolean(record.catalogueExclude) ??
      false,
    audienceTag:
      asString(record.audienceTag) ??
      asString(record.catalogueAudienceTag) ??
      null,
    ctaMode:
      asString(record.ctaMode) ??
      asString(record.catalogueCtaMode) ??
      null,
    storyBlock:
      asString(record.storyBlock) ??
      asString(record.catalogueStoryBlock) ??
      null,
  };
}

function normalizeCatalogueReadiness(readiness: unknown): {
  ready: boolean;
  readyForCatalogue: boolean;
  blockers: string[];
  warnings: string[];
  [key: string]: any;
} {
  const record = isRecord(readiness) ? readiness : {};

  const blockers = dedupeStrings(toStringArray(record.blockers));
  const warnings = dedupeStrings(toStringArray(record.warnings));
  const ready = asBoolean(record.ready) ?? blockers.length === 0;
  const readyForCatalogue =
    asBoolean(record.readyForCatalogue) ?? ready;

  return {
    ...record,
    ready,
    readyForCatalogue,
    blockers,
    warnings,
  };
}

function normalizeHierarchyNode(node: unknown): ProductReadHierarchyNode | null {
  if (!isRecord(node)) return null;

  return {
    ...node,
    id: asString(node.id),
    slug: asString(node.slug),
    name:
      asString(node.name) ??
      asString(node.label) ??
      asString(node.title) ??
      asString(node.slug),
    path: asString(node.path),
    depth: asNumber(node.depth),
  };
}

function normalizeHierarchy(hierarchy: unknown): ProductReadHierarchy {
  const record = isRecord(hierarchy) ? hierarchy : {};
  const lineage = Array.isArray(record.lineage)
    ? record.lineage
        .map((node) => normalizeHierarchyNode(node))
        .filter((node): node is ProductReadHierarchyNode => node !== null)
    : [];

  return {
    ...record,
    path: asString(record.path),
    depth: asNumber(record.depth) ?? lineage.length,
    lineage,
    mainCategory: record.mainCategory ?? null,
    subCategory: record.subCategory ?? null,
    subSubCategory: record.subSubCategory ?? null,
    leafCategory: record.leafCategory ?? null,
  };
}

function buildAi(source: UnknownRecord): ProductReadAi {
  const tryOnEligible =
    asBoolean(source.aiTryOnEligible) ??
    asBoolean(source.tryOnEligible) ??
    false;

  const roomEligible =
    asBoolean(source.aiRoomEligible) ??
    asBoolean(source.roomEligible) ??
    false;

  const arTryOnEligible =
    asBoolean(source.arTryOnEligible) ??
    asBoolean(source.arEligible) ??
    false;

  const mirrorEligible =
    asBoolean(source.mirrorEligible) ??
    tryOnEligible;

  return {
    tryOnEligible,
    roomEligible,
    arTryOnEligible,
    arEligible: arTryOnEligible,
    mirrorEligible,
  };
}

function buildPolicies(source: UnknownRecord): ProductReadPolicies {
  return {
    codEligible: asBoolean(source.codEligible) ?? false,
    returnEligible: asBoolean(source.returnEligible) ?? false,
    returnPolicy: asString(source.returnPolicy),
  };
}

function buildCta(
  source: UnknownRecord,
  flags: {
    audienceTag: string | null;
    ctaMode: string | null;
    storyBlock: string | null;
  },
): ProductReadCta {
  return {
    mode:
      flags.ctaMode ??
      asString(source.ctaMode) ??
      asString(source.catalogueCtaMode) ??
      null,
    audienceTag:
      flags.audienceTag ??
      asString(source.audienceTag) ??
      asString(source.catalogueAudienceTag) ??
      null,
    storyBlock:
      flags.storyBlock ??
      asString(source.storyBlock) ??
      asString(source.catalogueStoryBlock) ??
      null,
  };
}

function buildTimestamps(source: UnknownRecord, now?: Date): ProductReadTimestamps {
  const createdAt = asDate(source.createdAt);
  const updatedAt = asDate(source.updatedAt);
  const fallback = now ?? new Date(0);

  return {
    createdAt: createdAt ?? updatedAt ?? fallback,
    updatedAt: updatedAt ?? createdAt ?? fallback,
  };
}

function buildIdentity(source: UnknownRecord): ProductReadIdentity {
  const name = pickName(source) ?? '';
  const title = asString(source.title) ?? name;
  const shortName =
    asString(source.shortName) ??
    asString(source.short_label) ??
    name;
  const poeticLine =
    asString(source.poeticLine) ??
    asString(source.tagline) ??
    asString(source.excerpt) ??
    asString(source.summary) ??
    null;

  return {
    id: asString(source.id) ?? '',
    slug: asString(source.slug) ?? asString(source.handle) ?? '',
    sku: asString(source.sku) ?? '',
    name,
    title,
    shortName,
    poeticLine,
    status: asString(source.status) ?? '',
    active: asBoolean(source.active) ?? asBoolean(source.enabled) ?? true,
    enabled: asBoolean(source.enabled) ?? asBoolean(source.active) ?? true,
    published: asBoolean(source.published) ?? true,
  };
}

function buildCategory(
  hierarchy: ProductReadHierarchy,
  breadcrumbs: unknown,
  source: UnknownRecord,
): ProductReadCategory {
  const path =
    hierarchy.path ??
    asString(source.categoryPath) ??
    null;

  const breadcrumb = hierarchy.lineage
    .map((node) => node.slug)
    .filter((value): value is string => Boolean(value));

  const level = hierarchy.depth ?? hierarchy.lineage.length;

  const leafCategory =
    hierarchy.leafCategory ??
    (hierarchy.lineage.length > 0 ? hierarchy.lineage[hierarchy.lineage.length - 1] : null);

  const name =
    getStringFromRecord(leafCategory, ['name', 'label', 'title', 'slug']) ??
    null;

  return {
    path,
    level,
    breadcrumb,
    breadcrumbs: Array.isArray(breadcrumbs)
      ? (breadcrumbs.filter(isRecord) as Array<Record<string, any>>)
      : [],
    hierarchy,
    mainCategory: hierarchy.mainCategory,
    subCategory: hierarchy.subCategory,
    subSubCategory: hierarchy.subSubCategory,
    leafCategory: hierarchy.leafCategory,
    name,
  };
}

export function buildBadges(source: unknown): ProductReadBadge[] {
  const safe = (isRecord(source) ? source : {}) as ProductBadgeSourceRow;
  return buildBadgesCore(safe);
}

export function buildHierarchy(source: unknown): ProductReadHierarchy {
  const safe = (isRecord(source) ? source : {}) as ProductHierarchySource;
  const result = buildHierarchyCore(safe);
  return normalizeHierarchy(result);
}

export function buildCategoryBreadcrumbs(hierarchy: unknown): Array<Record<string, any>> {
  const safe = isRecord(hierarchy) ? hierarchy : {};
  const result = buildCategoryBreadcrumbsCore(safe as any);
  return Array.isArray(result)
    ? (result.filter(isRecord) as Array<Record<string, any>>)
    : [];
}

export function buildMedia(source: unknown): Record<string, any> {
  const safe = isRecord(source) ? source : {};
  const result = resolveMediaCore(safe as any);
  return normalizeMediaPayload(result, safe);
}

export const resolveMedia = buildMedia;

export function buildPricing(source: unknown, _now?: Date): ProductReadPricing {
  const safe = isRecord(source) ? source : {};
  return normalizePricing(buildPricingCore(safe as any));
}

export function deriveStock(source: unknown): ProductReadStock {
  const safe = isRecord(source) ? source : {};
  return normalizeStock(deriveStockCore(safe as any));
}

export function normalizeStockVisibility(value: unknown): string {
  return normalizeStockVisibilityCore(value as any);
}

export function buildCatalogueFlags(source: unknown) {
  const safe = isRecord(source) ? source : {};
  return normalizeCatalogueFlags(buildCatalogueFlagsCore(safe as any));
}

export function buildCatalogueReadiness(
  source: unknown,
  media?: unknown,
  pricing?: unknown,
  stock?: unknown,
): {
  ready: boolean;
  readyForCatalogue: boolean;
  blockers: string[];
  warnings: string[];
  [key: string]: any;
} {
  const safe = isRecord(source) ? source : {};

  const normalized = normalizeCatalogueReadiness(
    buildCatalogueReadinessCore(
      safe as any,
      media as any,
      pricing as any,
      stock as any,
    ),
  );

  return {
    ...normalized,
    readyForCatalogue:
      typeof (normalized as any).readyForCatalogue === 'boolean'
        ? (normalized as any).readyForCatalogue
        : normalized.ready,
  };
}

function mapVariant(
  variant: ProductReadVariantSource,
  _mode?: string,
  now?: Date,
): ProductReadVariant {
  const source = isRecord(variant) ? variant : {};
  const pricing = buildPricing(source, now);
  const stock = deriveStock(source);
  const media = buildMedia(source);
  const badges = buildBadges(source);
  const timestamps = buildTimestamps(source, now);
  const catalogueFlags = buildCatalogueFlags(source);
  const cta = buildCta(source, catalogueFlags);
  const catalogueReadiness = buildCatalogueReadiness(source, media, pricing, stock);
  const identity = buildIdentity(source);

  const catalogue: ProductReadCatalogue = {
    featured: catalogueFlags.featured,
    bestseller: catalogueFlags.bestseller,
    editorial: catalogueFlags.editorial,
    pinHero: catalogueFlags.pinHero,
    exclude: catalogueFlags.exclude,
    audienceTag: catalogueFlags.audienceTag,
    ctaMode: catalogueFlags.ctaMode,
    mode: cta.mode,
    storyBlock: catalogueFlags.storyBlock,
    preferredImage: asString(media.preferredImage),
    imageApproved: !!media.imageApproved,
    imageQualityScore: media.imageQualityScore ?? null,
    stockVisibility: stock.stockVisibility ?? 'IN_STOCK_ONLY',
    cta,
    readiness: catalogueReadiness,
  };

  return {
    id: asString(source.id),
    slug: asString(source.slug),
    sku: asString(source.sku),
    name: pickName(source),
    description: pickDescription(source),
    color: asString(source.color),
    material: asString(source.material),
    finish: asString(source.finish),
    size: asString(source.size),
    active: asBoolean(source.active) ?? asBoolean(source.enabled) ?? true,
    identity,
    pricing,
    stock,
    catalogue,
    badges,
    primaryImage: asString(media.primaryImage),
    gallery: toStringArray(media.gallery),
    productImages: toStringArray(media.productImages),
    variantImages: toStringArray(media.variantImages),
    media,
    timestamps,
  };
}

export function buildProductReadModel(
  product: ProductReadSourceRow,
  _mode?: string,
  now?: Date,
): ProductReadModel {
  const source = isRecord(product) ? product : {};

  const pricing = buildPricing(source, now);
  const stock = deriveStock(source);
  const media = buildMedia(source);
  const hierarchy = buildHierarchy(source);
  const breadcrumbs = buildCategoryBreadcrumbs(hierarchy);
  const badges = buildBadges(source);
  const ai = buildAi(source);
  const policies = buildPolicies(source);

  const catalogueFlags = buildCatalogueFlags(source);
  const cta = buildCta(source, catalogueFlags);
  const catalogueReadiness = buildCatalogueReadiness(source, media, pricing, stock);

  const catalogue: ProductReadCatalogue = {
    featured: catalogueFlags.featured,
    bestseller: catalogueFlags.bestseller,
    editorial: catalogueFlags.editorial,
    pinHero: catalogueFlags.pinHero,
    exclude: catalogueFlags.exclude,
    audienceTag: catalogueFlags.audienceTag,
    ctaMode: catalogueFlags.ctaMode,
    mode: cta.mode,
    storyBlock: catalogueFlags.storyBlock,
    preferredImage: asString(media.preferredImage),
    imageApproved: !!media.imageApproved,
    imageQualityScore: media.imageQualityScore ?? null,
    stockVisibility: stock.stockVisibility ?? 'IN_STOCK_ONLY',
    cta,
    readiness: catalogueReadiness,
  };

  const variants = toRecordArray<ProductReadVariantSource>(source.variants).map(
    (variant) => mapVariant(variant, _mode, now),
  );

  const normalizedVariants =
    Array.isArray(variants) &&
    variants.length === 1 &&
    (stock?.totalInventory ?? 0) > 0 &&
    ((variants[0]?.stock?.totalInventory ?? variants[0]?.inventory ?? 0) <= 0)
      ? variants.map((variant) => ({
          ...variant,
          inventory: stock?.totalInventory ?? variant?.inventory ?? 0,
          stock: {
            ...(variant?.stock ?? {}),
            inStock: stock?.inStock ?? variant?.stock?.inStock ?? false,
            totalInventory:
              stock?.totalInventory ?? variant?.stock?.totalInventory ?? 0,
            lowStock: stock?.lowStock ?? variant?.stock?.lowStock ?? false,
            stockVisibility:
              stock?.stockVisibility ??
              variant?.stock?.stockVisibility ??
              'IN_STOCK_ONLY',
            availableQuantity:
              stock?.availableQuantity ?? variant?.stock?.availableQuantity ?? null,
            showExactQuantity:
              stock?.showExactQuantity ??
              variant?.stock?.showExactQuantity ??
              false,
            label: stock?.label ?? variant?.stock?.label ?? null,
            purchasable:
              stock?.purchasable ?? variant?.stock?.purchasable ?? false,
            visibleInListing:
              stock?.visibleInListing ??
              variant?.stock?.visibleInListing ??
              true,
          },
        }))
      : variants;

  const category = buildCategory(hierarchy, breadcrumbs, source);

  const categoryPath = category.path;
  const categoryLevel = category.level;
  const categoryBreadcrumb = category.breadcrumb;

  const imageList = dedupeStrings([
    asString(media.primaryImage),
    ...toStringArray(media.gallery),
    ...toStringArray(media.productImages),
  ]);

  const createdAt = asDate(source.createdAt);
  const updatedAt = asDate(source.updatedAt);
  const timestamps = buildTimestamps(source, now);
  const identity = buildIdentity(source);

  return {
    ...source,
    ...pricing,
    ...stock,
    id: asString(source.id),
    slug: asString(source.slug) ?? asString(source.handle),
    sku: asString(source.sku),
    name: pickName(source),
    title: asString(source.title) ?? pickName(source),
    description: asString(source.description),
    shortDescription: asString(source.shortDescription),
    excerpt: asString(source.excerpt),
    summary: asString(source.summary),
    region: asString(source.region),
    origin: asString(source.origin),
    status: asString(source.status),
    active: asBoolean(source.active) ?? asBoolean(source.enabled) ?? true,
    enabled: asBoolean(source.enabled) ?? asBoolean(source.active) ?? true,
    published: asBoolean(source.published) ?? true,
    metaTitle: asString(source.metaTitle),
    metaDescription: asString(source.metaDescription),

    identity,

    ai,
    aiTryOnEligible: ai.tryOnEligible,
    aiRoomEligible: ai.roomEligible,
    arTryOnEligible: ai.arTryOnEligible,
    arEligible: ai.arEligible,
    mirrorEligible: ai.mirrorEligible,

    policies,
    purchase: policies,
    commerce: policies,
    codEligible: policies.codEligible,
    returnEligible: policies.returnEligible,
    returnPolicy: policies.returnPolicy,

    cta,
    catalogueCta: cta,

    category,
    tags: dedupeStrings([
      ...toStringArray(source.tags),
      ...toStringArray(source.labels),
    ]),
    labels: dedupeStrings(toStringArray(source.labels)),
    primaryImage: asString(media.primaryImage),
    image: asString(media.primaryImage),
    images: imageList,
    gallery: toStringArray(media.gallery),
    productImages: toStringArray(media.productImages),
    variantImages: toStringArray(media.variantImages),
    media,
    pricing,
    stock,
    catalogue,
    badges,
    hierarchy,
    categoryPath,
    categoryLevel,
    categoryBreadcrumb,
    breadcrumbs: category.breadcrumbs,
    mainCategory: category.mainCategory,
    subCategory: category.subCategory,
    subSubCategory: category.subSubCategory,
    leafCategory: category.leafCategory,

    catalogueFlags,
    catalogueFeatured: catalogueFlags.featured,
    catalogueBestseller: catalogueFlags.bestseller,
    catalogueEditorial: catalogueFlags.editorial,
    cataloguePinHero: catalogueFlags.pinHero,
    catalogueExclude: catalogueFlags.exclude,
    cataloguePreferredImage: asString(media.preferredImage),
    catalogueAudienceTag: catalogueFlags.audienceTag,
    catalogueCtaMode: catalogueFlags.ctaMode,
    catalogueStoryBlock: catalogueFlags.storyBlock,
    catalogueImageApproved: !!media.imageApproved,
    catalogueImageQualityScore: media.imageQualityScore ?? null,
    catalogueStockVisibility: stock.stockVisibility ?? 'IN_STOCK_ONLY',
    catalogueReadiness,

    variants: normalizedVariants,
    createdAt,
    updatedAt,
    timestamps,
  };
}
