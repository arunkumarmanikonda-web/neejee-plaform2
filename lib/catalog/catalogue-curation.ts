import type {
  ProductReadCatalogueFlags,
  ProductReadCatalogueReadiness,
  ProductReadMedia,
  ProductReadPricing,
  ProductReadStock,
} from './contracts';

export type CatalogueCurationSourceRow = {
  status?: string | null;
  catalogueFeatured?: boolean | null;
  catalogueBestseller?: boolean | null;
  catalogueEditorial?: boolean | null;
  cataloguePinHero?: boolean | null;
  catalogueExclude?: boolean | null;
  catalogueAudienceTag?: string | null;
  catalogueCtaMode?: string | null;
  catalogueStoryBlock?: string | null;
};

function asString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

export function buildCatalogueFlags(
  product: CatalogueCurationSourceRow
): ProductReadCatalogueFlags {
  return {
    featured: !!product.catalogueFeatured,
    bestseller: !!product.catalogueBestseller,
    editorial: !!product.catalogueEditorial,
    pinHero: !!product.cataloguePinHero,
    exclude: !!product.catalogueExclude,
    audienceTag: asString(product.catalogueAudienceTag),
    ctaMode: asString(product.catalogueCtaMode),
    storyBlock: asString(product.catalogueStoryBlock),
  };
}

export function buildCatalogueReadiness(
  product: CatalogueCurationSourceRow,
  media: ProductReadMedia,
  pricing: ProductReadPricing,
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
