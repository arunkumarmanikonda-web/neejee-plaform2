import type { PremiumCatalogueEngineOutput, PremiumCatalogueTone } from '../contracts';

export const PREMIUM_CATALOGUE_TEMPLATE_VERSION = 'phase2.catalogue-template.v1';

export const PREMIUM_CATALOGUE_TEMPLATE_KEYS = [
  'luxury_signature',
  'editorial_story',
  'gifting_spotlight',
  'seasonal_drop',
  'evergreen_grid',
] as const;

export type PremiumCatalogueTemplateKey =
  (typeof PREMIUM_CATALOGUE_TEMPLATE_KEYS)[number];

export const PREMIUM_CATALOGUE_TEMPLATE_BLOCK_KINDS = [
  'hero',
  'story',
  'product-strip',
  'grid',
  'meta',
] as const;

export type PremiumCatalogueTemplateBlockKind =
  (typeof PREMIUM_CATALOGUE_TEMPLATE_BLOCK_KINDS)[number];

export interface PremiumCatalogueTemplateProductCard {
  id: string;
  slug: string;
  sku: string;
  name: string;
  shortName: string | null;
  poeticLine: string | null;
  description: string | null;
  primaryImage: string | null;
  gallery: string[];
  pricing: {
    currency: string;
    mrp: number | null;
    sellingPrice: number | null;
    salePrice: number | null;
    effectivePrice: number | null;
    discountPercent: number | null;
  };
  stock: {
    inStock: boolean;
    label: string;
    totalInventory: number;
  };
  categoryPath: string | null;
  badges: string[];
  catalogue: {
    featured: boolean;
    bestseller: boolean;
    editorial: boolean;
    pinHero: boolean;
    audienceTag: string | null;
    ctaMode: string | null;
    storyBlock: string | null;
  };
}

export interface PremiumCatalogueTemplateBlock {
  key: string;
  kind: PremiumCatalogueTemplateBlockKind;
  title: string;
  subtitle: string | null;
  body: string | null;
  productIds: string[];
  products: PremiumCatalogueTemplateProductCard[];
  meta: Record<string, string | number | boolean | null | string[]>;
}

export interface PremiumCatalogueTemplateRenderResult {
  version: typeof PREMIUM_CATALOGUE_TEMPLATE_VERSION;
  templateKey: PremiumCatalogueTemplateKey;
  tone: PremiumCatalogueTone;
  title: string;
  slug: string;
  generatedAt: string;
  selectionKey: string;
  productIds: string[];
  blocks: PremiumCatalogueTemplateBlock[];
}

export interface PremiumCatalogueTemplateRenderMap {
  [templateKey: string]: PremiumCatalogueTemplateRenderResult;
}

export type PremiumCatalogueTemplateInput = PremiumCatalogueEngineOutput;
