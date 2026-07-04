import { PRODUCT_READ_MODEL_VERSION } from './contracts';
import type { ProductReadModel } from './product-read';
import {
  orderCatalogueGallery,
  selectCatalogueProducts,
  type CatalogueGalleryItem,
  type CatalogueSelectorRequest,
  type CatalogueSelectionResult,
} from './selectors';

export const CATALOGUE_EXPORT_VERSION = 'phase1.catalogue-export.v1' as const;

export type CatalogueExportRequest = {
  products: ProductReadModel[];
  categoryPath?: string | null;
  categorySlug?: string | null;
  campaignKey?: string | null;
  limit?: number;
  generatedAt?: Date | string | null;
};

export type CatalogueExportMedia = {
  primaryImage: string | null;
  approvedPrimaryImage: string | null;
  preferredImage: string | null;
  gallery: string[];
  approvedGallery: string[];
  productImages: string[];
  variantImages: string[];
  video: string | null;
  imageApproved: boolean;
  imageQualityScore: number | null;
  hasMedia: boolean;
  hasApprovedMedia: boolean;
  selectionMode: string | null;
  selectionSource: string | null;
  fallbackApplied: boolean;
};

export type CatalogueExportPricing = {
  currency: string;
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  effectivePrice: number | null;
  discountPercent: number | null;
  gstRate: number | null;
  saleWindow: {
    startsAt: string | null;
    endsAt: string | null;
    active: boolean;
  };
};

export type CatalogueExportStock = {
  inStock: boolean;
  lowStock: boolean;
  totalInventory: number;
  availableQuantity: number | null;
  stockVisibility: string | null;
  showExactQuantity: boolean;
  purchasable: boolean;
  label: string | null;
};

export type CatalogueExportCatalogue = {
  featured: boolean;
  bestseller: boolean;
  editorial: boolean;
  pinHero: boolean;
  exclude: boolean;
  audienceTag: string | null;
  ctaMode: string | null;
  storyBlock: string | null;
  preferredImage: string | null;
  imageApproved: boolean;
  imageQualityScore: number | null;
  stockVisibility: string | null;
  readiness: {
    readyForCatalogue: boolean;
    visibleInFeed: boolean;
    usesApprovedMedia: boolean;
    blockers: string[];
  };
};

export type CatalogueExportHierarchyNode = {
  id: string | null;
  slug: string | null;
  name: string | null;
  path: string | null;
  level: number | null;
};

export type CatalogueExportVariant = {
  id: string | null;
  sku: string | null;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  material: string | null;
  inventory: number;
  inStock: boolean;
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  images: string[];
};

export type CatalogueExportProduct = {
  id: string | null;
  slug: string | null;
  sku: string | null;
  source: string | null;
  version: string;
  status: string | null;
  active: boolean;
  enabled: boolean;
  published: boolean;

  name: string | null;
  title: string | null;
  shortDescription: string | null;
  description: string | null;
  summary: string | null;
  excerpt: string | null;

  craft: {
    craft: string | null;
    region: string | null;
    state: string | null;
    cluster: string | null;
    artisanName: string | null;
    material: string | null;
    technique: string | null;
    occasion: string | null;
    story: string | null;
    craftNote: string | null;
    careInstructions: string | null;
    sustainabilityNote: string | null;
  };

  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
  };

  category: {
    id: string | null;
    slug: string | null;
    name: string | null;
    path: string | null;
    level: number | null;
  };

  hierarchy: {
    path: string | null;
    depth: number | null;
    lineage: CatalogueExportHierarchyNode[];
    breadcrumb: string[];
    mainCategory: CatalogueExportHierarchyNode | null;
    subCategory: CatalogueExportHierarchyNode | null;
    subSubCategory: CatalogueExportHierarchyNode | null;
    leafCategory: CatalogueExportHierarchyNode | null;
  };

  media: CatalogueExportMedia;
  pricing: CatalogueExportPricing;
  stock: CatalogueExportStock;
  catalogue: CatalogueExportCatalogue;

  badges: Array<Record<string, any>>;
  tags: string[];
  labels: string[];

  policies: {
    codEligible: boolean;
    returnEligible: boolean;
    returnPolicy: string | null;
  };

  ai: {
    tryOnEligible: boolean;
    roomEligible: boolean;
    arTryOnEligible: boolean;
    mirrorEligible: boolean;
  };

  fulfilment: {
    mode: string | null;
    depositPercent: number | null;
    releaseDate: string | null;
    editionSize: number | null;
    editionSold: number | null;
  };

  variants: CatalogueExportVariant[];

  timestamps: {
    createdAt: string | null;
    updatedAt: string | null;
  };
};

export type CatalogueExportSelection = {
  selectionKey: string;
  categoryPath: string | null;
  categorySlug: string | null;
  campaignKey: string | null;
  totalInput: number;
  totalMatched: number;
  totalEligible: number;
  excludedProductIds: string[];
  heroProductId: string | null;
  heroProductSlug: string | null;
  orderedProductIds: string[];
  orderedGallery: CatalogueGalleryItem[];
};

export type CatalogueExportPayload = {
  version: typeof CATALOGUE_EXPORT_VERSION;
  canonicalReadModelVersion: typeof PRODUCT_READ_MODEL_VERSION;
  generatedAt: string;
  selection: CatalogueExportSelection;
  products: CatalogueExportProduct[];
};

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toIso(value: unknown): string | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item: string): item is string => item.length > 0);
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (!value) continue;
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

function toHierarchyNode(node: unknown): CatalogueExportHierarchyNode | null {
  if (!node || typeof node !== 'object') return null;

  const raw = node as Record<string, unknown>;

  return {
    id: asString(raw.id),
    slug: asString(raw.slug),
    name: asString(raw.name),
    path: asString(raw.path),
    level: asNumber(raw.level),
  };
}

function getLineage(product: ProductReadModel): CatalogueExportHierarchyNode[] {
  const hierarchy = ((product as any)?.hierarchy ?? {}) as Record<string, unknown>;
  const lineage = Array.isArray(hierarchy.lineage) ? hierarchy.lineage : [];

  return lineage
    .map((node: unknown) => toHierarchyNode(node))
    .filter(
      (
        node: CatalogueExportHierarchyNode | null
      ): node is CatalogueExportHierarchyNode => Boolean(node)
    );
}

function buildExportMedia(product: ProductReadModel): CatalogueExportMedia {
  const raw = ((product as any)?.media ?? {}) as Record<string, unknown>;

  return {
    primaryImage: asString(raw.primaryImage) ?? asString((product as any)?.primaryImage),
    approvedPrimaryImage: asString(raw.approvedPrimaryImage),
    preferredImage:
      asString(raw.preferredImage) ??
      asString((product as any)?.cataloguePreferredImage),
    gallery: toStringArray(raw.gallery ?? (product as any)?.gallery),
    approvedGallery: toStringArray(raw.approvedGallery),
    productImages: toStringArray(raw.productImages ?? (product as any)?.productImages),
    variantImages: toStringArray(raw.variantImages ?? (product as any)?.variantImages),
    video: asString(raw.video),
    imageApproved: asBoolean(
      raw.imageApproved,
      asBoolean((product as any)?.catalogueImageApproved, false)
    ),
    imageQualityScore:
      asNumber(raw.imageQualityScore) ??
      asNumber((product as any)?.catalogueImageQualityScore),
    hasMedia: asBoolean(raw.hasMedia, false),
    hasApprovedMedia: asBoolean(raw.hasApprovedMedia, false),
    selectionMode: asString(raw.selectionMode),
    selectionSource: asString(raw.selectionSource),
    fallbackApplied: asBoolean(raw.fallbackApplied, false),
  };
}

function buildExportPricing(product: ProductReadModel): CatalogueExportPricing {
  const pricing = ((product as any)?.pricing ?? {}) as Record<string, unknown>;
  const saleWindow = ((pricing.saleWindow ?? {}) as Record<string, unknown>) ?? {};

  const mrp = asNumber(pricing.mrp);
  const sellingPrice = asNumber(pricing.sellingPrice);
  const salePrice = asNumber(pricing.salePrice);

  let effectivePrice = asNumber(pricing.effectivePrice);
  if (effectivePrice == null) {
    effectivePrice = salePrice ?? sellingPrice ?? mrp;
  }

  let discountPercent = asNumber(pricing.discountPercent);
  if (discountPercent == null && mrp && effectivePrice != null && mrp > 0) {
    discountPercent = Math.max(0, Math.round(((mrp - effectivePrice) / mrp) * 100));
  }

  return {
    currency: asString(pricing.currency) ?? 'INR',
    mrp,
    sellingPrice,
    salePrice,
    effectivePrice,
    discountPercent,
    gstRate: asNumber(pricing.gstRate),
    saleWindow: {
      startsAt: toIso(saleWindow.startsAt),
      endsAt: toIso(saleWindow.endsAt),
      active: asBoolean(saleWindow.active, false),
    },
  };
}

function buildExportStock(product: ProductReadModel): CatalogueExportStock {
  const stock = ((product as any)?.stock ?? {}) as Record<string, unknown>;

  return {
    inStock: asBoolean(stock.inStock, false),
    lowStock: asBoolean(stock.lowStock, false),
    totalInventory: asNumber(stock.totalInventory) ?? 0,
    availableQuantity: asNumber(stock.availableQuantity),
    stockVisibility:
      asString(stock.stockVisibility) ??
      asString((product as any)?.catalogueStockVisibility),
    showExactQuantity: asBoolean(stock.showExactQuantity, false),
    purchasable: asBoolean(stock.purchasable, false),
    label: asString(stock.label),
  };
}

function buildExportCatalogue(
  product: ProductReadModel,
  media: CatalogueExportMedia,
  stock: CatalogueExportStock
): CatalogueExportCatalogue {
  const catalogue = ((product as any)?.catalogue ?? {}) as Record<string, unknown>;
  const readiness = (((product as any)?.catalogueReadiness ??
    catalogue.readiness ??
    {}) ?? {}) as Record<string, unknown>;

  return {
    featured: asBoolean(catalogue.featured, asBoolean((product as any)?.catalogueFeatured)),
    bestseller: asBoolean(
      catalogue.bestseller,
      asBoolean((product as any)?.catalogueBestseller)
    ),
    editorial: asBoolean(
      catalogue.editorial,
      asBoolean((product as any)?.catalogueEditorial)
    ),
    pinHero: asBoolean(catalogue.pinHero, asBoolean((product as any)?.cataloguePinHero)),
    exclude: asBoolean(catalogue.exclude, asBoolean((product as any)?.catalogueExclude)),
    audienceTag:
      asString(catalogue.audienceTag) ??
      asString((product as any)?.catalogueAudienceTag),
    ctaMode:
      asString(catalogue.ctaMode) ??
      asString((product as any)?.catalogueCtaMode),
    storyBlock:
      asString(catalogue.storyBlock) ??
      asString((product as any)?.catalogueStoryBlock),
    preferredImage: media.preferredImage,
    imageApproved: media.imageApproved,
    imageQualityScore: media.imageQualityScore,
    stockVisibility: stock.stockVisibility,
    readiness: {
      readyForCatalogue: asBoolean(readiness.readyForCatalogue, false),
      visibleInFeed: asBoolean(readiness.visibleInFeed, false),
      usesApprovedMedia: asBoolean(readiness.usesApprovedMedia, false),
      blockers: toStringArray(readiness.blockers),
    },
  };
}

function buildExportVariants(product: ProductReadModel): CatalogueExportVariant[] {
  const variants = Array.isArray((product as any)?.variants)
    ? ((product as any).variants as any[])
    : [];

  return variants
    .map((variant: any) => {
      const variantPricing = (variant?.pricing ?? {}) as Record<string, unknown>;
      const variantStock = (variant?.stock ?? {}) as Record<string, unknown>;
      const images = dedupeStrings([
        ...toStringArray(variant?.images),
        ...toStringArray(variant?.media?.gallery),
      ]);

      const inventory =
        asNumber(variantStock.totalInventory) ??
        asNumber(variant?.inventory) ??
        0;

      return {
        id: asString(variant?.id),
        sku: asString(variant?.sku),
        size: asString(variant?.size),
        color: asString(variant?.color),
        colorHex: asString(variant?.colorHex),
        material: asString(variant?.material),
        inventory,
        inStock: asBoolean(variantStock.inStock, inventory > 0),
        mrp: asNumber(variant?.mrp) ?? asNumber(variantPricing.mrp),
        sellingPrice:
          asNumber(variant?.sellingPrice) ?? asNumber(variantPricing.sellingPrice),
        salePrice: asNumber(variant?.salePrice) ?? asNumber(variantPricing.salePrice),
        images,
      };
    })
    .sort((a: CatalogueExportVariant, b: CatalogueExportVariant) => {
      const aSku = a.sku ?? '';
      const bSku = b.sku ?? '';
      return aSku.localeCompare(bSku);
    });
}

export function buildCatalogueExportProduct(
  product: ProductReadModel
): CatalogueExportProduct {
  const raw = (product ?? {}) as any;
  const identity = (raw.identity ?? {}) as Record<string, unknown>;
  const craft = (raw.craft ?? {}) as Record<string, unknown>;
  const category = (raw.category ?? {}) as Record<string, unknown>;
  const hierarchy = (raw.hierarchy ?? {}) as Record<string, unknown>;
  const policies =
    ((raw.policies ?? raw.purchase ?? raw.commerce ?? {}) as Record<
      string,
      unknown
    >) ?? {};
  const ai = (raw.ai ?? {}) as Record<string, unknown>;
  const fulfilment = (raw.fulfilment ?? {}) as Record<string, unknown>;
  const media = buildExportMedia(product);
  const pricing = buildExportPricing(product);
  const stock = buildExportStock(product);
  const catalogue = buildExportCatalogue(product, media, stock);
  const lineage = getLineage(product);

  return {
    id: asString(raw.id),
    slug: asString(raw.slug),
    sku: asString(raw.sku),
    source: asString(raw.source),
    version: CATALOGUE_EXPORT_VERSION,
    status: asString(raw.status),
    active: asBoolean(raw.active, false),
    enabled: asBoolean(raw.enabled, false),
    published: asBoolean(raw.published, false),

    name: asString(identity.name) ?? asString(raw.name),
    title: asString(raw.title) ?? asString(identity.name) ?? asString(raw.name),
    shortDescription:
      asString(raw.shortDescription) ?? asString(identity.shortDescription),
    description:
      asString(identity.description) ??
      asString(raw.description) ??
      asString(raw.shortDescription),
    summary: asString(raw.summary),
    excerpt: asString(raw.excerpt),

    craft: {
      craft: asString(craft.craft) ?? asString(raw.craft),
      region: asString(craft.region) ?? asString(raw.region),
      state: asString(craft.state) ?? asString(raw.state),
      cluster: asString(craft.cluster) ?? asString(raw.cluster),
      artisanName: asString(craft.artisanName) ?? asString(raw.artisanName),
      material: asString(craft.material) ?? asString(raw.material),
      technique: asString(craft.technique) ?? asString(raw.technique),
      occasion: asString(craft.occasion) ?? asString(raw.occasion),
      story: asString(craft.story) ?? asString(raw.story),
      craftNote: asString(craft.craftNote) ?? asString(raw.craftNote),
      careInstructions:
        asString(craft.careInstructions) ?? asString(raw.careInstructions),
      sustainabilityNote:
        asString(craft.sustainabilityNote) ??
        asString(raw.sustainabilityNote),
    },

    seo: {
      metaTitle: asString(raw.metaTitle),
      metaDescription: asString(raw.metaDescription),
    },

    category: {
      id: asString(category.id),
      slug: asString(category.slug),
      name: asString(category.name),
      path: asString(category.path) ?? asString(raw.categoryPath),
      level: asNumber(category.level) ?? asNumber(raw.categoryLevel),
    },

    hierarchy: {
      path: asString(hierarchy.path) ?? asString(raw.categoryPath),
      depth: asNumber(hierarchy.depth) ?? asNumber(raw.categoryLevel),
      lineage,
      breadcrumb: Array.isArray(raw.categoryBreadcrumb)
        ? toStringArray(raw.categoryBreadcrumb)
        : lineage
            .map((node: CatalogueExportHierarchyNode) => node.name)
            .filter((value: string | null): value is string => Boolean(value)),
      mainCategory: toHierarchyNode(raw.mainCategory),
      subCategory: toHierarchyNode(raw.subCategory),
      subSubCategory: toHierarchyNode(raw.subSubCategory),
      leafCategory: toHierarchyNode(raw.leafCategory) ?? toHierarchyNode(category),
    },

    media,
    pricing,
    stock,
    catalogue,

    badges: Array.isArray(raw.badges) ? raw.badges : [],
    tags: toStringArray(raw.tags),
    labels: toStringArray(raw.labels),

    policies: {
      codEligible: asBoolean(policies.codEligible, asBoolean(raw.codEligible)),
      returnEligible: asBoolean(
        policies.returnEligible,
        asBoolean(raw.returnEligible)
      ),
      returnPolicy: asString(policies.returnPolicy) ?? asString(raw.returnPolicy),
    },

    ai: {
      tryOnEligible: asBoolean(ai.tryOnEligible, asBoolean(raw.aiTryOnEligible)),
      roomEligible: asBoolean(ai.roomEligible, asBoolean(raw.aiRoomEligible)),
      arTryOnEligible: asBoolean(
        ai.arTryOnEligible,
        asBoolean(raw.arTryOnEligible)
      ),
      mirrorEligible: asBoolean(ai.mirrorEligible, asBoolean(raw.mirrorEligible)),
    },

    fulfilment: {
      mode: asString(fulfilment.mode) ?? asString(raw.fulfilmentMode),
      depositPercent:
        asNumber(fulfilment.depositPercent) ?? asNumber(raw.depositPercent),
      releaseDate: toIso(fulfilment.releaseDate) ?? toIso(raw.releaseDate),
      editionSize: asNumber(fulfilment.editionSize) ?? asNumber(raw.editionSize),
      editionSold: asNumber(fulfilment.editionSold) ?? asNumber(raw.editionSold),
    },

    variants: buildExportVariants(product),

    timestamps: {
      createdAt: toIso(raw.createdAt),
      updatedAt: toIso(raw.updatedAt),
    },
  };
}

export function buildCatalogueExportProducts(
  products: ProductReadModel[]
): CatalogueExportProduct[] {
  return [...products]
    .map((product: ProductReadModel) => buildCatalogueExportProduct(product))
    .sort((a: CatalogueExportProduct, b: CatalogueExportProduct) => {
      const aSlug = a.slug ?? '';
      const bSlug = b.slug ?? '';
      if (aSlug !== bSlug) return aSlug.localeCompare(bSlug);

      const aSku = a.sku ?? '';
      const bSku = b.sku ?? '';
      if (aSku !== bSku) return aSku.localeCompare(bSku);

      const aId = a.id ?? '';
      const bId = b.id ?? '';
      return aId.localeCompare(bId);
    });
}

function buildSelectionSummary(
  request: CatalogueExportRequest,
  selection: CatalogueSelectionResult,
  orderedGallery: CatalogueGalleryItem[]
): CatalogueExportSelection {
  return {
    selectionKey: selection.selectionKey,
    categoryPath: request.categoryPath ?? null,
    categorySlug: request.categorySlug ?? null,
    campaignKey: request.campaignKey ?? null,
    totalInput: selection.totalInput,
    totalMatched: selection.totalMatched,
    totalEligible: selection.totalEligible,
    excludedProductIds: [...selection.excludedProductIds],
    heroProductId: (selection.heroProduct as any)?.id ?? null,
    heroProductSlug: (selection.heroProduct as any)?.slug ?? null,
    orderedProductIds: selection.orderedProducts
      .map((product: any) => asString(product?.id))
      .filter((id: string | null): id is string => Boolean(id)),
    orderedGallery,
  };
}

export function buildCatalogueExportPayload(
  request: CatalogueExportRequest
): CatalogueExportPayload {
  const selectorRequest: CatalogueSelectorRequest = {
    products: request.products,
    categoryPath: request.categoryPath ?? null,
    categorySlug: request.categorySlug ?? null,
    campaignKey: request.campaignKey ?? null,
    limit: request.limit,
  };

  const selection = selectCatalogueProducts(selectorRequest);
  const orderedGallery = orderCatalogueGallery(selection.orderedProducts, {
    categoryPath: request.categoryPath ?? null,
    categorySlug: request.categorySlug ?? null,
    campaignKey: request.campaignKey ?? null,
  });

  const generatedAt =
    request.generatedAt instanceof Date
      ? request.generatedAt.toISOString()
      : typeof request.generatedAt === 'string' && request.generatedAt.trim().length > 0
        ? request.generatedAt
        : new Date().toISOString();

  return {
    version: CATALOGUE_EXPORT_VERSION,
    canonicalReadModelVersion: PRODUCT_READ_MODEL_VERSION,
    generatedAt,
    selection: buildSelectionSummary(request, selection, orderedGallery),
    products: buildCatalogueExportProducts(selection.orderedProducts),
  };
}
