import test from 'node:test';
import assert from 'node:assert/strict';

import type { ProductReadModel } from '../../lib/catalog/contracts';
import { buildPremiumCatalogueEngine } from '../../lib/catalog-engine/engine';
import {
  PREMIUM_CATALOGUE_TEMPLATE_KEYS,
  renderAllPremiumCatalogueTemplates,
  renderPremiumCatalogueTemplate,
} from '../../lib/catalog-engine/templates';

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
    status: 'ACTIVE',

    identity: {
      name: 'Default Product',
      shortName: 'Default',
      poeticLine: 'A curated product.',
      description: 'Default description',
    },

    pricing: {
      currency: 'INR',
      mrp: 1000,
      sellingPrice: 800,
      salePrice: 700,
      effectivePrice: 700,
      displayPrice: 700,
      onSale: true,
      discountAmount: 300,
      discountPercent: 30,
      saleWindow: {
        startsAt: null,
        endsAt: null,
      },
      gstRate: 12,
      hsnCode: null,
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

    badges: [],
    category: {
      id: 'cat-home',
      slug: 'home',
      name: 'Home',
      path: 'home',
      level: 1,
    },

    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt,
    timestamps: {
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt,
    },
  };

  const merged = {
    ...base,
    ...overrides,
    identity: {
      ...(base.identity as Record<string, unknown>),
      ...((overrides.identity as Record<string, unknown> | undefined) ?? {}),
    },
    pricing: {
      ...(base.pricing as Record<string, unknown>),
      ...((overrides.pricing as Record<string, unknown> | undefined) ?? {}),
    },
    media: {
      ...(base.media as Record<string, unknown>),
      ...((overrides.media as Record<string, unknown> | undefined) ?? {}),
    },
    stock: {
      ...(base.stock as Record<string, unknown>),
      ...((overrides.stock as Record<string, unknown> | undefined) ?? {}),
    },
    hierarchy: {
      ...(base.hierarchy as Record<string, unknown>),
      ...((overrides.hierarchy as Record<string, unknown> | undefined) ?? {}),
    },
    catalogue: {
      ...(base.catalogue as Record<string, unknown>),
      ...((overrides.catalogue as Record<string, unknown> | undefined) ?? {}),
    },
    category: {
      ...(base.category as Record<string, unknown>),
      ...((overrides.category as Record<string, unknown> | undefined) ?? {}),
    },
    timestamps: {
      ...(base.timestamps as Record<string, unknown>),
      ...((overrides.timestamps as Record<string, unknown> | undefined) ?? {}),
    },
  };

  return merged as unknown as ProductReadModel;
}

test('renderAllPremiumCatalogueTemplates renders every template from the same engine output without errors', () => {
  const pinned = makeProduct({
    id: 'prod-pinned',
    slug: 'pinned-product',
    sku: 'SKU-001',
    identity: {
      name: 'Pinned Product',
      shortName: 'Pinned',
      poeticLine: 'Lead the story.',
      description: 'Pinned description',
    },
    catalogue: {
      featured: true,
      bestseller: false,
      editorial: true,
      pinHero: true,
      exclude: false,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Pinned story block',
    },
    badges: ['FOUNDERS_EDIT'],
    updatedAt: new Date('2026-07-07T12:00:00.000Z'),
    timestamps: {
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-07T12:00:00.000Z'),
    },
  });

  const featured = makeProduct({
    id: 'prod-featured',
    slug: 'featured-product',
    sku: 'SKU-002',
    identity: {
      name: 'Featured Product',
      shortName: 'Featured',
      poeticLine: 'Supporting curation.',
      description: 'Featured description',
    },
    catalogue: {
      featured: true,
      bestseller: true,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: null,
    },
  });

  const grid = makeProduct({
    id: 'prod-grid',
    slug: 'grid-product',
    sku: 'SKU-003',
    identity: {
      name: 'Grid Product',
      shortName: 'Grid',
      poeticLine: 'Grid support.',
      description: 'Grid description',
    },
    catalogue: {
      featured: false,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: null,
    },
  });

  const engineOutput = buildPremiumCatalogueEngine({
    brief: {
      id: 'brief-templates',
      slug: 'luxury-home-edit',
      title: 'Luxury Home Edit',
      tone: 'luxury',
      featuredLimit: 1,
      audienceTags: ['LUXURY_HOME'],
    },
    products: [featured, grid, pinned],
  });

  const rendered = renderAllPremiumCatalogueTemplates(engineOutput);

  assert.equal(rendered.length, PREMIUM_CATALOGUE_TEMPLATE_KEYS.length);

  for (const result of rendered) {
    assert.deepEqual(result.productIds, engineOutput.selection.orderedProductIds);
    assert.ok(result.blocks.length >= 4);
    assert.ok(result.blocks.some(block => block.kind === 'hero'));
    assert.ok(result.blocks.some(block => block.kind === 'product-strip'));
    assert.ok(result.blocks.some(block => block.kind === 'grid'));
    assert.ok(result.blocks.some(block => block.kind === 'meta'));
  }
});

test('renderPremiumCatalogueTemplate resolves default template from tone deterministically', () => {
  const first = makeProduct({
    id: 'prod-a',
    slug: 'alpha',
    sku: 'A-001',
    catalogue: {
      featured: true,
      bestseller: false,
      editorial: false,
      pinHero: true,
      exclude: false,
      audienceTag: 'SEASONAL',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Seasonal lead',
    },
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
  });

  const engineOutput = buildPremiumCatalogueEngine({
    brief: {
      id: 'brief-seasonal',
      slug: 'seasonal-drop',
      title: 'Seasonal Drop',
      tone: 'seasonal',
      featuredLimit: 1,
      audienceTags: ['SEASONAL'],
    },
    products: [second, first],
  });

  const result = renderPremiumCatalogueTemplate(engineOutput);

  assert.equal(result.templateKey, 'seasonal_drop');
  assert.equal(result.title, 'Seasonal Drop');
  assert.deepEqual(result.productIds, engineOutput.selection.orderedProductIds);
  assert.ok(result.blocks[0].title.length > 0);
});
