import type { ProductReadModel } from '../catalog/contracts';

export const PREMIUM_CATALOGUE_ENGINE_VERSION = 'phase2.catalogue-engine.v1';
export const DEFAULT_PREMIUM_CATALOGUE_FEATURED_LIMIT = 4;

export const PREMIUM_CATALOGUE_TONES = [
  'luxury',
  'editorial',
  'gifting',
  'seasonal',
  'evergreen',
] as const;

export type PremiumCatalogueTone = (typeof PREMIUM_CATALOGUE_TONES)[number];

export const PREMIUM_CATALOGUE_SECTION_KINDS = [
  'hero',
  'featured',
  'grid',
] as const;

export type PremiumCatalogueSectionKind =
  (typeof PREMIUM_CATALOGUE_SECTION_KINDS)[number];

export interface PremiumCatalogueEngineBrief {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  tone?: PremiumCatalogueTone | null;
  featuredLimit?: number | null;
  includeProductIds?: string[] | null;
  excludeProductIds?: string[] | null;
  audienceTags?: string[] | null;
  generatedAt?: string | Date | null;
}

export interface PremiumCatalogueEngineNormalizedBrief {
  id: string | null;
  slug: string | null;
  title: string | null;
  tone: PremiumCatalogueTone;
  featuredLimit: number;
  includeProductIds: string[];
  excludeProductIds: string[];
  audienceTags: string[];
  generatedAt: string | null;
}

export interface PremiumCatalogueEngineRequest {
  brief: PremiumCatalogueEngineBrief;
  products: ProductReadModel[];
}

export interface PremiumCatalogueSelectionSummary {
  selectionKey: string;
  totalInput: number;
  totalMatched: number;
  totalEligible: number;
  includedProductIds: string[];
  excludedProductIds: string[];
  orderedProductIds: string[];
  heroProductId: string | null;
}

export interface PremiumCatalogueMerchandisingSummary {
  tone: PremiumCatalogueTone;
  featuredLimit: number;
  includedCount: number;
  excludedCount: number;
  inStockCount: number;
  approvedImageCount: number;
  pinnedCount: number;
  featuredCount: number;
  bestsellerCount: number;
  editorialCount: number;
}

export interface PremiumCatalogueGalleryItem {
  productId: string;
  slug: string | null;
  primaryImage: string | null;
  approved: boolean;
  qualityScore: number | null;
  pinHero: boolean;
  featured: boolean;
  bestseller: boolean;
  editorial: boolean;
  inStock: boolean;
  effectivePrice: number | null;
  updatedAt: string | null;
}

export interface PremiumCatalogueSection {
  kind: PremiumCatalogueSectionKind;
  title: string;
  productIds: string[];
  products: ProductReadModel[];
}

export interface PremiumCatalogueEngineOutput {
  version: typeof PREMIUM_CATALOGUE_ENGINE_VERSION;
  generatedAt: string;
  brief: PremiumCatalogueEngineNormalizedBrief;
  selection: PremiumCatalogueSelectionSummary;
  merchandising: PremiumCatalogueMerchandisingSummary;
  heroProduct: ProductReadModel | null;
  gallery: PremiumCatalogueGalleryItem[];
  sections: PremiumCatalogueSection[];
  products: ProductReadModel[];
}
