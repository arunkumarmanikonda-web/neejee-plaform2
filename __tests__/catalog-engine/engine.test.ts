import test from 'node:test';
import assert from 'node:assert/strict';

import type { ProductReadModel } from '../../lib/catalog/contracts';
import { buildPremiumCatalogueEngine } from '../../lib/catalog-engine';

function makeProduct(overrides: Record<string, unknown> = {}): ProductReadModel {
  const id = (overrides.id as string) ?? 'prod-default';
  const slug = (overrides.slug as string) ?? 'default-product';
  const sku = (overrides.sku as string) ?? 'SKU-DEFAULT';
  const updatedAt =
    overrides.updatedAt instanceof Date
      ? overrides.updatedAt
      : new Date('2026-07-07T10:00:00.000Z');

  const base: Record<string, unknown> = {
    version: 'phase1.product-read.v1',
    source: 'test',
    id,
    slug,
    sku,
    sellerId: 'seller-1',
    name: 'Default Product',
    title: 'Default Product',
    description: 'Default description',
    shortDescription: 'Default short description',
    summary: 'Default summary',
    excerpt: 'Default excerpt',
    status: 'ACTIVE',
    active: true,
    enabled: true,
    published: true,

    identity: {
      name: 'Default Product',
      title: 'Default Product',
      shortDescription: 'Default short description',
      description: 'Default description',
    },

    craft: {
      craft: null,
      region: null,
      state: null,
      cluster: null,
      artisanName: null,
      material: null,
      technique: null,
      occasion: null,
      story: null,
      craftNote: null,
      careInstructions: null,
      sustainabilityNote: null,
    },

    category: {
      id: 'cat-home',
      slug: 'home',
      name: 'Home',
      path: 'home',
      level: 1,
    },

    hierarchy: {
      lineage: [],
      breadcrumb: ['Home'],
      breadcrumbSlugs: ['home'],
      path: 'home',
      depth: 1,
      mainCategory: null,
      subCategory: null,
      subSubCategory: null,
      leafCategory: null,
    },

    pricing: {
      currency: 'INR',
      mrp: 1000,
      sellingPrice: 800,
      salePrice: 700,
      effectivePrice: 700,
      discountPercent: 30,
      gstRate: 12,
      saleWindow: {
        startsAt: null,
        endsAt: null,
        active: false,
      },
    },

    stock: {
      inStock: true,
      totalInventory: 5,
      lowStock: false,
      stockVisibility: 'SHOW_ALL',
      availableQuantity: 5,
      showExactQuantity: true,
      label: '5 available',
      purchasable: true,
    },

    media: {
      primaryImage: `https://example.com/${slug}.jpg`,
      approvedPrimaryImage: `https://example.com/${slug}.jpg`,
      preferredImage: `https://example.com/${slug}.jpg`,
      gallery: [`https://example.com/${slug}.jpg`],
      approvedGallery: [`https://example.com/${slug}.jpg`],
      productImages: [`https://example.com/${slug}.jpg`],
      variantImages: [],
      video: null,
      imageApproved: true,
      imageQualityScore: 90,
      selectionMode: 'preferred_override',
      selectionSource: 'external_override',
      fallbackApplied: false,
      hasMedia: true,
      hasApprovedMedia: true,
    },

    catalogue: {
      featured: false,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: null,
      ctaMode: null,
      storyBlock: null,
    },

    fulfilment: {
      mode: 'IN_STOCK',
      depositPercent: null,
      releaseDate: null,
      editionSize: null,
      editionSold: null,
    },

    policies: {
      codEligible: false,
      returnEligible: false,
      returnPolicy: null,
    },

    ai: {
      tryOnEligible: false,
      roomEligible: false,
      arTryOnEligible: false,
      mirrorEligible: false,
    },

    badges: [],
    variants: [],

    timestamps: {
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt,
    },

    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt,

    catalogueFlags: {
      featured: false,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: null,
      ctaMode: null,
      storyBlock: null,
    },

    catalogueFeatured: false,
    catalogueBestseller: false,
    catalogueEditorial: false,
    cataloguePinHero: false,
    catalogueExclude: false,
    cataloguePreferredImage: `https://example.com/${slug}.jpg`,
    catalogueAudienceTag: null,
    catalogueCtaMode: null,
    catalogueStoryBlock: null,
    catalogueImageApproved: true,
    catalogueImageQualityScore: 90,
    catalogueStockVisibility: 'SHOW_ALL',
    catalogueReadiness: {
      readyForCatalogue: true,
      visibleInFeed: true,
      usesApprovedMedia: true,
      blockers: [],
    },
  };

  const merged = {
    ...base,
    ...overrides,
    identity: {
      ...(base.identity as Record<string, unknown>),
      ...((overrides.identity as Record<string, unknown> | undefined) ?? {}),
    },
    craft: {
      ...(base.craft as Record<string, unknown>),
      ...((overrides.craft as Record<string, unknown> | undefined) ?? {}),
    },
    category: {
      ...(base.category as Record<string, unknown>),
      ...((overrides.category as Record<string, unknown> | undefined) ?? {}),
    },
    hierarchy: {
      ...(base.hierarchy as Record<string, unknown>),
      ...((overrides.hierarchy as Record<string, unknown> | undefined) ?? {}),
    },
    pricing: {
      ...(base.pricing as Record<string, unknown>),
      ...((overrides.pricing as Record<string, unknown> | undefined) ?? {}),
    },
    stock: {
      ...(base.stock as Record<string, unknown>),
      ...((overrides.stock as Record<string, unknown> | undefined) ?? {}),
    },
    media: {
      ...(base.media as Record<string, unknown>),
      ...((overrides.media as Record<string, unknown> | undefined) ?? {}),
    },
    catalogue: {
      ...(base.catalogue as Record<string, unknown>),
      ...((overrides.catalogue as Record<string, unknown> | undefined) ?? {}),
    },
    fulfilment: {
      ...(base.fulfilment as Record<string, unknown>),
      ...((overrides.fulfilment as Record<string, unknown> | undefined) ?? {}),
    },
    policies: {
      ...(base.policies as Record<string, unknown>),
      ...((overrides.policies as Record<string, unknown> | undefined) ?? {}),
    },
    ai: {
      ...(base.ai as Record<string, unknown>),
      ...((overrides.ai as Record<string, unknown> | undefined) ?? {}),
    },
    timestamps: {
      ...(base.timestamps as Record<string, unknown>),
      ...((overrides.timestamps as Record<string, unknown> | undefined) ?? {}),
    },
    catalogueFlags: {
      ...(base.catalogueFlags as Record<string, unknown>),
      ...((overrides.catalogueFlags as Record<string, unknown> | undefined) ?? {}),
    },
  };

  return merged as unknown as ProductReadModel;
}

test('buildPremiumCatalogueEngine is deterministic for the same brief regardless of input order', () => {
  const pinned = makeProduct({
    id: 'prod-pinned',
    slug: 'pinned-product',
    sku: 'SKU-001',
    catalogue: {
      featured: true,
      bestseller: false,
      editorial: false,
      pinHero: true,
      exclude: false,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Pinned story',
    },
    catalogueFlags: {
      featured: true,
      bestseller: false,
      editorial: false,
      pinHero: true,
      exclude: false,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Pinned story',
    },
    catalogueFeatured: true,
    cataloguePinHero: true,
    catalogueAudienceTag: 'LUXURY_HOME',
    updatedAt: new Date('2026-07-07T12:00:00.000Z'),
    timestamps: {
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-07T12:00:00.000Z'),
    },
  });

  const editorial = makeProduct({
    id: 'prod-editorial',
    slug: 'editorial-product',
    sku: 'SKU-002',
    catalogue: {
      featured: false,
      bestseller: false,
      editorial: true,
      pinHero: false,
      exclude: false,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Editorial story',
    },
    catalogueFlags: {
      featured: false,
      bestseller: false,
      editorial: true,
      pinHero: false,
      exclude: false,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Editorial story',
    },
    catalogueEditorial: true,
    catalogueAudienceTag: 'LUXURY_HOME',
    updatedAt: new Date('2026-07-06T12:00:00.000Z'),
    timestamps: {
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-06T12:00:00.000Z'),
    },
  });

  const excluded = makeProduct({
    id: 'prod-excluded',
    slug: 'excluded-product',
    sku: 'SKU-003',
    catalogue: {
      featured: true,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: true,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Excluded story',
    },
    catalogueFlags: {
      featured: true,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: true,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Excluded story',
    },
    catalogueFeatured: true,
    catalogueExclude: true,
    catalogueAudienceTag: 'LUXURY_HOME',
  });

  const brief = {
    id: 'brief-1',
    slug: 'luxury-home-edit',
    title: 'Luxury Home Edit',
    tone: 'luxury' as const,
    featuredLimit: 2,
    audienceTags: ['LUXURY_HOME'],
  };

  const resultA = buildPremiumCatalogueEngine({
    brief,
    products: [pinned, editorial, excluded],
  });

  const resultB = buildPremiumCatalogueEngine({
    brief,
    products: [excluded, editorial, pinned],
  });

  assert.deepEqual(resultA.selection.orderedProductIds, resultB.selection.orderedProductIds);
  assert.equal(resultA.selection.heroProductId, 'prod-pinned');
  assert.equal(resultB.selection.heroProductId, 'prod-pinned');
  assert.deepEqual(resultA.selection.orderedProductIds, ['prod-pinned', 'prod-editorial']);
  assert.deepEqual(resultA.selection.excludedProductIds, ['prod-excluded']);
  assert.deepEqual(resultA.sections.map(section => section.kind), ['hero', 'featured']);
  assert.equal(resultA.generatedAt, '2026-07-07T12:00:00.000Z');
});

test('buildPremiumCatalogueEngine respects include and exclude ids deterministically', () => {
  const first = makeProduct({
    id: 'prod-a',
    slug: 'alpha',
    sku: 'A-001',
  });

  const second = makeProduct({
    id: 'prod-b',
    slug: 'beta',
    sku: 'B-001',
    catalogue: {
      featured: true,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: 'SEASONAL',
      ctaMode: 'SHOP_NOW',
      storyBlock: null,
    },
    catalogueFlags: {
      featured: true,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: 'SEASONAL',
      ctaMode: 'SHOP_NOW',
      storyBlock: null,
    },
    catalogueFeatured: true,
    catalogueAudienceTag: 'SEASONAL',
  });

  const third = makeProduct({
    id: 'prod-c',
    slug: 'gamma',
    sku: 'C-001',
  });

  const result = buildPremiumCatalogueEngine({
    brief: {
      id: 'brief-2',
      slug: 'seasonal-drop',
      title: 'Seasonal Drop',
      tone: 'seasonal',
      includeProductIds: ['prod-c', 'prod-b', 'prod-a'],
      excludeProductIds: ['prod-c'],
      generatedAt: '2026-07-07T18:00:00.000Z',
    },
    products: [third, first, second],
  });

  assert.equal(result.generatedAt, '2026-07-07T18:00:00.000Z');
  assert.deepEqual(result.selection.includedProductIds, ['prod-a', 'prod-b']);
  assert.deepEqual(result.selection.orderedProductIds, ['prod-b', 'prod-a']);
  assert.equal(result.selection.heroProductId, 'prod-b');
  assert.equal(result.selection.totalInput, 3);
  assert.equal(result.selection.totalMatched, 2);
  assert.equal(result.selection.totalEligible, 2);
});
