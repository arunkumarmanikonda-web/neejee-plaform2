import type { ProductReadModel } from '../../catalog/contracts';
import type {
  PremiumCatalogueEngineOutput,
  PremiumCatalogueTone,
} from '../contracts';
import {
  PREMIUM_CATALOGUE_TEMPLATE_KEYS,
  PREMIUM_CATALOGUE_TEMPLATE_VERSION,
  type PremiumCatalogueTemplateBlock,
  type PremiumCatalogueTemplateKey,
  type PremiumCatalogueTemplateProductCard,
  type PremiumCatalogueTemplateRenderMap,
  type PremiumCatalogueTemplateRenderResult,
} from './contracts';

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  );
}

function fallbackTitle(templateKey: PremiumCatalogueTemplateKey): string {
  switch (templateKey) {
    case 'luxury_signature':
      return 'Luxury Signature';
    case 'editorial_story':
      return 'Editorial Story';
    case 'gifting_spotlight':
      return 'Gifting Spotlight';
    case 'seasonal_drop':
      return 'Seasonal Drop';
    case 'evergreen_grid':
      return 'Evergreen Grid';
    default:
      return 'Premium Catalogue';
  }
}

export function resolvePremiumCatalogueTemplateKey(
  tone: PremiumCatalogueTone
): PremiumCatalogueTemplateKey {
  switch (tone) {
    case 'luxury':
      return 'luxury_signature';
    case 'editorial':
      return 'editorial_story';
    case 'gifting':
      return 'gifting_spotlight';
    case 'seasonal':
      return 'seasonal_drop';
    case 'evergreen':
    default:
      return 'evergreen_grid';
  }
}

function toProductCard(product: ProductReadModel): PremiumCatalogueTemplateProductCard {
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: product.identity.name,
    shortName: product.identity.shortName,
    poeticLine: product.identity.poeticLine,
    description: product.identity.description,
    primaryImage:
      product.media.preferredImage ??
      product.media.approvedPrimaryImage ??
      product.media.primaryImage,
    gallery:
      product.media.approvedGallery.length > 0
        ? product.media.approvedGallery
        : product.media.gallery,
    pricing: {
      currency: product.pricing.currency,
      mrp: product.pricing.mrp,
      sellingPrice: product.pricing.sellingPrice,
      salePrice: product.pricing.salePrice,
      effectivePrice: product.pricing.effectivePrice,
      discountPercent: product.pricing.discountPercent,
    },
    stock: {
      inStock: product.stock.inStock,
      label: product.stock.label,
      totalInventory: product.stock.totalInventory,
    },
    categoryPath: product.hierarchy.path ?? product.category?.path ?? null,
    badges: product.badges,
    catalogue: {
      featured: product.catalogue.featured,
      bestseller: product.catalogue.bestseller,
      editorial: product.catalogue.editorial,
      pinHero: product.catalogue.pinHero,
      audienceTag: product.catalogue.audienceTag,
      ctaMode: product.catalogue.ctaMode,
      storyBlock: product.catalogue.storyBlock,
    },
  };
}

function getSectionProducts(
  engineOutput: PremiumCatalogueEngineOutput,
  kind: 'hero' | 'featured' | 'grid'
): ProductReadModel[] {
  const section = engineOutput.sections.find(item => item.kind === kind);
  if (section) return section.products;

  if (kind === 'hero') {
    return engineOutput.heroProduct ? [engineOutput.heroProduct] : [];
  }

  if (kind === 'featured') {
    const heroId = engineOutput.heroProduct?.id ?? null;
    return engineOutput.products
      .filter(product => product.id !== heroId)
      .slice(0, engineOutput.brief.featuredLimit);
  }

  const heroId = engineOutput.heroProduct?.id ?? null;
  const featuredIds = new Set(getSectionProducts(engineOutput, 'featured').map(item => item.id));

  return engineOutput.products.filter(
    product => product.id !== heroId && !featuredIds.has(product.id)
  );
}

function buildLeadBody(engineOutput: PremiumCatalogueEngineOutput): string {
  const hero = engineOutput.heroProduct;

  if (hero?.catalogue.storyBlock) {
    return hero.catalogue.storyBlock;
  }

  if (hero?.identity.poeticLine) {
    return hero.identity.poeticLine;
  }

  if (hero?.identity.description) {
    return hero.identity.description;
  }

  const audience =
    engineOutput.brief.audienceTags.length > 0
      ? engineOutput.brief.audienceTags.join(' · ')
      : 'general audience';

  return `${engineOutput.brief.title ?? 'Premium catalogue'} curated for ${audience}.`;
}

function buildMetaBlock(engineOutput: PremiumCatalogueEngineOutput): PremiumCatalogueTemplateBlock {
  return {
    key: 'meta',
    kind: 'meta',
    title: 'Merchandising Summary',
    subtitle: engineOutput.brief.tone,
    body: `Eligible ${engineOutput.selection.totalEligible} of ${engineOutput.selection.totalInput} products.`,
    productIds: [],
    products: [],
    meta: {
      tone: engineOutput.merchandising.tone,
      featuredLimit: engineOutput.merchandising.featuredLimit,
      includedCount: engineOutput.merchandising.includedCount,
      excludedCount: engineOutput.merchandising.excludedCount,
      inStockCount: engineOutput.merchandising.inStockCount,
      approvedImageCount: engineOutput.merchandising.approvedImageCount,
      pinnedCount: engineOutput.merchandising.pinnedCount,
      featuredCount: engineOutput.merchandising.featuredCount,
      bestsellerCount: engineOutput.merchandising.bestsellerCount,
      editorialCount: engineOutput.merchandising.editorialCount,
      audienceTags: engineOutput.brief.audienceTags,
    },
  };
}

function createBlock(
  key: string,
  kind: PremiumCatalogueTemplateBlock['kind'],
  title: string,
  subtitle: string | null,
  body: string | null,
  products: ProductReadModel[],
  meta: PremiumCatalogueTemplateBlock['meta'] = {}
): PremiumCatalogueTemplateBlock {
  return {
    key,
    kind,
    title,
    subtitle,
    body,
    productIds: products.map(product => product.id),
    products: products.map(toProductCard),
    meta,
  };
}

function buildBlocks(
  templateKey: PremiumCatalogueTemplateKey,
  engineOutput: PremiumCatalogueEngineOutput
): PremiumCatalogueTemplateBlock[] {
  const heroProducts = getSectionProducts(engineOutput, 'hero');
  const featuredProducts = getSectionProducts(engineOutput, 'featured');
  const gridProducts = getSectionProducts(engineOutput, 'grid');
  const leadBody = buildLeadBody(engineOutput);
  const title = engineOutput.brief.title ?? fallbackTitle(templateKey);

  switch (templateKey) {
    case 'luxury_signature':
      return [
        createBlock(
          'hero',
          'hero',
          title,
          'Signature Hero',
          leadBody,
          heroProducts
        ),
        createBlock(
          'story',
          'story',
          'Luxury Narrative',
          'Elevated curation',
          `A premium edit anchored by ${engineOutput.selection.heroProductId ?? 'the lead selection'} and supported by approved imagery, stock visibility, and deterministic ordering.`,
          []
        ),
        createBlock(
          'featured',
          'product-strip',
          'Signature Picks',
          `${featuredProducts.length} featured products`,
          null,
          featuredProducts
        ),
        createBlock(
          'grid',
          'grid',
          'Catalogue Continuum',
          `${gridProducts.length} supporting products`,
          null,
          gridProducts
        ),
        buildMetaBlock(engineOutput),
      ];

    case 'editorial_story':
      return [
        createBlock(
          'hero',
          'hero',
          title,
          'Editorial Lead',
          leadBody,
          heroProducts
        ),
        createBlock(
          'story',
          'story',
          'Story Arc',
          'Editorial framing',
          `This layout emphasizes narrative sequencing: hero lead, curated picks, then broader discovery from the same engine output contract.`,
          []
        ),
        createBlock(
          'featured',
          'product-strip',
          'Editor Picks',
          `${featuredProducts.length} curated products`,
          null,
          featuredProducts
        ),
        createBlock(
          'grid',
          'grid',
          'More To Discover',
          `${gridProducts.length} additional products`,
          null,
          gridProducts
        ),
        buildMetaBlock(engineOutput),
      ];

    case 'gifting_spotlight':
      return [
        createBlock(
          'hero',
          'hero',
          title,
          'Gift Lead',
          leadBody,
          heroProducts
        ),
        createBlock(
          'story',
          'story',
          'Gifting Message',
          'Occasion-led presentation',
          `Designed for gift-driven merchandising with a lead item, supporting recommendations, and fast scan product strips.`,
          []
        ),
        createBlock(
          'featured',
          'product-strip',
          'Gift Picks',
          `${featuredProducts.length} ready-to-highlight products`,
          null,
          featuredProducts
        ),
        createBlock(
          'grid',
          'grid',
          'Extended Gift Set',
          `${gridProducts.length} additional products`,
          null,
          gridProducts
        ),
        buildMetaBlock(engineOutput),
      ];

    case 'seasonal_drop':
      return [
        createBlock(
          'hero',
          'hero',
          title,
          'Seasonal Hero',
          leadBody,
          heroProducts
        ),
        createBlock(
          'story',
          'story',
          'Seasonal Frame',
          'Campaign-led arrangement',
          `This template is optimized for seasonal launches, keeping the hero forward and preserving deterministic supporting order.`,
          []
        ),
        createBlock(
          'featured',
          'product-strip',
          'Launch Picks',
          `${featuredProducts.length} spotlight products`,
          null,
          featuredProducts
        ),
        createBlock(
          'grid',
          'grid',
          'Full Drop',
          `${gridProducts.length} remaining products`,
          null,
          gridProducts
        ),
        buildMetaBlock(engineOutput),
      ];

    case 'evergreen_grid':
    default:
      return [
        createBlock(
          'hero',
          'hero',
          title,
          'Evergreen Lead',
          leadBody,
          heroProducts
        ),
        createBlock(
          'story',
          'story',
          'Core Catalogue Message',
          'Stable merchandising structure',
          `This evergreen template prioritizes reusability and continuous publishing with the same engine payload.`,
          []
        ),
        createBlock(
          'featured',
          'product-strip',
          'Core Picks',
          `${featuredProducts.length} highlighted products`,
          null,
          featuredProducts
        ),
        createBlock(
          'grid',
          'grid',
          'Always-On Catalogue',
          `${gridProducts.length} remaining products`,
          null,
          gridProducts
        ),
        buildMetaBlock(engineOutput),
      ];
  }
}

export function renderPremiumCatalogueTemplate(
  engineOutput: PremiumCatalogueEngineOutput,
  templateKey?: PremiumCatalogueTemplateKey
): PremiumCatalogueTemplateRenderResult {
  const resolvedTemplateKey =
    templateKey ?? resolvePremiumCatalogueTemplateKey(engineOutput.brief.tone);

  return {
    version: PREMIUM_CATALOGUE_TEMPLATE_VERSION,
    templateKey: resolvedTemplateKey,
    tone: engineOutput.brief.tone,
    title: engineOutput.brief.title ?? fallbackTitle(resolvedTemplateKey),
    slug: engineOutput.brief.slug ?? resolvedTemplateKey,
    generatedAt: engineOutput.generatedAt,
    selectionKey: engineOutput.selection.selectionKey,
    productIds: uniqueStrings(engineOutput.selection.orderedProductIds),
    blocks: buildBlocks(resolvedTemplateKey, engineOutput),
  };
}

export function renderAllPremiumCatalogueTemplates(
  engineOutput: PremiumCatalogueEngineOutput
): PremiumCatalogueTemplateRenderResult[] {
  return PREMIUM_CATALOGUE_TEMPLATE_KEYS.map(templateKey =>
    renderPremiumCatalogueTemplate(engineOutput, templateKey)
  );
}

export function renderPremiumCatalogueTemplateMap(
  engineOutput: PremiumCatalogueEngineOutput
): PremiumCatalogueTemplateRenderMap {
  return Object.fromEntries(
    renderAllPremiumCatalogueTemplates(engineOutput).map(result => [
      result.templateKey,
      result,
    ])
  );
}
