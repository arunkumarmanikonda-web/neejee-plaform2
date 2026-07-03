export { buildPricing } from './pricing-read';
export {
  deriveStock,
  normalizeStockVisibility,
} from './stock-visibility';

import {
  PRODUCT_READ_MODEL_VERSION,
  type ProductReadCatalogueReadiness,
  type ProductReadMedia,
  type ProductReadModel,
  type ProductReadSource,
  type ProductReadStock,
  type ProductReadVariant,
} from './contracts';
import {
  buildPricing,
  type PricingReadSourceRow,
} from './pricing-read';
import {
  deriveStock,
  type StockReadSourceRow,
} from './stock-visibility';
import { resolveMedia, type MediaReadSourceRow } from './media-read';
import { buildHierarchy, type ProductHierarchySource } from './hierarchy-read';

export type ProductReadCategorySource =
  | {
      id: string;
      name: string;
      slug: string;
      path?: string | null;
      level?: number | null;
      parentId?: string | null;
      parent?: ProductReadCategorySource | null;
    }
  | null;

export type ProductReadVariantSource = {
  id: string;
  sku: string;
  size?: string | null;
  color?: string | null;
  colorHex?: string | null;
  material?: string | null;
  inventory?: number | null;
  lowStockThreshold?: number | null;
  images?: unknown;
  mrp?: number | null;
  sellingPrice?: number | null;
};

export type ProductReadSourceRow = {
  id: string;
  slug: string;
  sku: string;
  sellerId?: string | null;
  status: string;

  name: string;
  shortName?: string | null;
  poeticLine?: string | null;
  description?: string | null;

  craft?: string | null;
  region?: string | null;
  state?: string | null;
  cluster?: string | null;
  artisanName?: string | null;
  material?: string | null;
  technique?: string | null;
  occasion?: string | null;
  story?: string | null;
  craftNote?: string | null;
  careInstructions?: string | null;
  sustainabilityNote?: string | null;

  mrp?: number | null;
  sellingPrice?: number | null;
  salePrice?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
  gstRate?: number | null;
  hsnCode?: string | null;

  images?: unknown;
  video?: string | null;
  badges?: unknown;

  catalogueFeatured?: boolean | null;
  catalogueBestseller?: boolean | null;
  catalogueEditorial?: boolean | null;
  cataloguePinHero?: boolean | null;
  catalogueExclude?: boolean | null;
  cataloguePreferredImage?: string | null;
  catalogueAudienceTag?: string | null;
  catalogueCtaMode?: string | null;
  catalogueStoryBlock?: string | null;
  catalogueImageApproved?: boolean | null;
  catalogueImageQualityScore?: number | null;
  catalogueStockVisibility?: string | null;

  codEligible?: boolean | null;
  returnEligible?: boolean | null;
  returnPolicy?: string | null;

  fulfilmentMode?: string | null;
  depositPercent?: number | null;
  releaseDate?: Date | null;
  editionSize?: number | null;
  editionSold?: number | null;

  aiTryOnEligible?: boolean | null;
  aiRoomEligible?: boolean | null;
  arTryOnEligible?: boolean | null;

  createdAt: Date;
  updatedAt: Date;

  category?: ProductReadCategorySource;
  categoryId?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  categoryPath?: string | null;
  categoryLevel?: number | null;

  variants?: ProductReadVariantSource[];
};

export function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item === undefined || item === null) return '';
      return String(item).trim();
    })
    .filter((item): item is string => item.length > 0);
}

export function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildMedia(product: ProductReadSourceRow): ProductReadMedia {
  return resolveMedia(product as MediaReadSourceRow);
}

export function buildCatalogueReadiness(
  product: ProductReadSourceRow,
  media: ProductReadMedia,
  pricing: ReturnType<typeof buildPricing>,
  stock: ProductReadStock
): ProductReadCatalogueReadiness {
  const blockers: string[] = [];

  if (product.status !== 'ACTIVE') blockers.push('inactive_status');
  if (!!product.catalogueExclude) blockers.push('excluded_from_catalogue');
  if (!media.primaryImage) blockers.push('missing_primary_image');
  if (!media.imageApproved) blockers.push('image_not_approved');
  if (!media.approvedPrimaryImage) {
    blockers.push('missing_approved_primary_image');
  }
  if (
    typeof pricing.effectivePrice !== 'number' ||
    !Number.isFinite(pricing.effectivePrice) ||
    pricing.effectivePrice <= 0
  ) {
    blockers.push('invalid_effective_price');
  }
  if (!stock.inStock && stock.stockVisibility === 'IN_STOCK_ONLY') {
    blockers.push('hidden_by_stock_rule');
  }

  return {
    readyForCatalogue: blockers.length === 0,
    visibleInFeed: product.status === 'ACTIVE' && !product.catalogueExclude,
    usesApprovedMedia: !!media.imageApproved && !!media.approvedPrimaryImage,
    blockers,
  };
}

export function mapVariant(variant: ProductReadVariantSource): ProductReadVariant {
  return {
    id: variant.id,
    sku: variant.sku,
    size: asString(variant.size),
    color: asString(variant.color),
    colorHex: asString(variant.colorHex),
    material: asString(variant.material),
    inventory:
      typeof variant.inventory === 'number'
        ? variant.inventory
        : Number.parseInt(String(variant.inventory ?? 0), 10) || 0,
    lowStockThreshold:
      typeof variant.lowStockThreshold === 'number'
        ? variant.lowStockThreshold
        : Number.parseInt(String(variant.lowStockThreshold ?? 3), 10) || 3,
    mrp:
      typeof variant.mrp === 'number'
        ? variant.mrp
        : Number.parseInt(String(variant.mrp ?? ''), 10) || null,
    sellingPrice:
      typeof variant.sellingPrice === 'number'
        ? variant.sellingPrice
        : Number.parseInt(String(variant.sellingPrice ?? ''), 10) || null,
    images: toStringArray(variant.images),
  };
}

export function buildProductReadModel(
  product: ProductReadSourceRow,
  source: ProductReadSource = 'catalogue',
  now = new Date()
): ProductReadModel {
  const pricing = buildPricing(product as PricingReadSourceRow, now);
  const media = buildMedia(product);
  const stock = deriveStock(product as StockReadSourceRow);
  const hierarchy = buildHierarchy(product as ProductHierarchySource);
  const catalogueReadiness = buildCatalogueReadiness(
    product,
    media,
    pricing,
    stock
  );

  return {
    version: PRODUCT_READ_MODEL_VERSION,
    source,
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    sellerId: product.sellerId ?? null,
    status: product.status,
    identity: {
      name: product.name,
      shortName: asString(product.shortName),
      poeticLine: asString(product.poeticLine),
      description: asString(product.description),
    },
    craft: {
      craft: asString(product.craft),
      region: asString(product.region),
      state: asString(product.state),
      cluster: asString(product.cluster),
      artisanName: asString(product.artisanName),
      material: asString(product.material),
      technique: asString(product.technique),
      occasion: asString(product.occasion),
      story: asString(product.story),
      craftNote: asString(product.craftNote),
      careInstructions: asString(product.careInstructions),
      sustainabilityNote: asString(product.sustainabilityNote),
    },
    pricing,
    media,
    stock,
    hierarchy,
    catalogue: {
      featured: !!product.catalogueFeatured,
      bestseller: !!product.catalogueBestseller,
      editorial: !!product.catalogueEditorial,
      pinHero: !!product.cataloguePinHero,
      exclude: !!product.catalogueExclude,
      audienceTag: asString(product.catalogueAudienceTag),
      ctaMode: asString(product.catalogueCtaMode),
      storyBlock: asString(product.catalogueStoryBlock),
    },
    catalogueReadiness,
    badges: dedupeStrings(toStringArray(product.badges)),
    fulfilment: {
      mode: asString(product.fulfilmentMode),
      depositPercent: product.depositPercent ?? null,
      releaseDate: product.releaseDate ?? null,
      editionSize: product.editionSize ?? null,
      editionSold: product.editionSold ?? null,
    },
    ai: {
      tryOnEligible: !!product.aiTryOnEligible,
      roomEligible: !!product.aiRoomEligible,
      arTryOnEligible: !!product.arTryOnEligible,
    },
    policies: {
      codEligible: product.codEligible !== false,
      returnEligible: product.returnEligible !== false,
      returnPolicy: asString(product.returnPolicy),
    },
    category: hierarchy.leafCategory,
    variants: (Array.isArray(product.variants) ? product.variants : []).map(
      mapVariant
    ),
    timestamps: {
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    },
  };
}
