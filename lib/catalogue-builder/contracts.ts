export type CatalogueProjectStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED';

export type CatalogueProjectCopy = {
  title: string;
  slug: string;
  seoTitle?: string | null;
  seoDesc?: string | null;
  founderName: string;
  preNote: string;
  endingNote: string;
  heroHeading: string;
  heroSubheading: string;
  sectionIntro: string;
  productNarratives: Record<string, string>;
  productPullQuotes: Record<string, string>;
};

export type CatalogueProjectSelection = {
  productIds: string[];
  categorySlug?: string | null;
  categoryPath?: string | null;
  limit?: number | null;
};

export type CatalogueProjectConfig = {
  version: 'catalogue-builder.v1';
  brandName: string;
  templateKey: 'luxury_signature';
  includeFounderNotes: boolean;
  includeClosingPage: boolean;
  coverImage?: string | null;
};

export type CatalogueProjectSections = {
  version: 'catalogue-builder.v1';
  config: CatalogueProjectConfig;
  selection: CatalogueProjectSelection;
  copy: CatalogueProjectCopy;
};

export type CatalogueProjectSummary = {
  id: string;
  slug: string;
  title: string;
  status: CatalogueProjectStatus;
  updatedAt: string;
  createdAt: string;
  productCount: number;
  founderName: string;
};

export type CatalogueBuilderProduct = {
  id: string;
  slug: string | null;
  sku: string | null;
  name: string;
  shortName: string | null;
  description: string | null;
  poeticLine: string | null;
  story: string | null;
  craft: string | null;
  region: string | null;
  material: string | null;
  technique: string | null;
  occasion: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryPath: string | null;
  mrp: number | null;
  sellingPrice: number | null;
  salePrice: number | null;
  totalInventory: number;
  image: string | null;
  images: string[];
  catalogueFeatured: boolean;
  cataloguePinHero: boolean;
  catalogueExclude: boolean;
  catalogueAudienceTag: string | null;
};

export type CatalogueProject = CatalogueProjectSummary & {
  pageType: string;
  template: string;
  sections: CatalogueProjectSections;
  products: CatalogueBuilderProduct[];
};

export type CatalogueDraftPayload = {
  preNote?: string;
  endingNote?: string;
  heroHeading?: string;
  heroSubheading?: string;
  sectionIntro?: string;
  productNarratives?: Record<string, string>;
  productPullQuotes?: Record<string, string>;
};

export const DEFAULT_CATALOGUE_PROJECT_COPY = (title = 'Neejee Premium Catalogue', slug = 'neejee-premium-catalogue'): CatalogueProjectCopy => ({
  title,
  slug,
  seoTitle: title,
  seoDesc: 'Founder-led premium catalogue for Neejee.',
  founderName: 'Nidhi Chauhan',
  preNote:
    'Neejee was shaped around objects that carry time with grace. This catalogue gathers pieces chosen not for speed, but for memory, material, and the quiet intimacy of craft.',
  endingNote:
    'Luxury, to us, is not spectacle. It is discernment, patience, and the decision to live with fewer things that mean more.',
  heroHeading: 'Found. Personal.',
  heroSubheading:
    'A founder-led catalogue of pieces selected from the live Neejee inventory for their material depth, craft integrity, and emotional permanence.',
  sectionIntro:
    'Each selection in this catalogue comes from the existing eligible inventory and is arranged as an editorial narrative rather than a wholesale grid.',
  productNarratives: {},
  productPullQuotes: {},
});

export const DEFAULT_CATALOGUE_PROJECT_CONFIG = (): CatalogueProjectConfig => ({
  version: 'catalogue-builder.v1',
  brandName: 'Neejee',
  templateKey: 'luxury_signature',
  includeFounderNotes: true,
  includeClosingPage: true,
  coverImage: null,
});
