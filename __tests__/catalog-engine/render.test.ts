import test from 'node:test';
import assert from 'node:assert/strict';

import type { ProductReadModel } from '../../lib/catalog/contracts';
import {
  buildPremiumCatalogueEngine,
  renderPremiumCatalogueHtmlDocument,
  renderPremiumCataloguePdfBuffer,
  renderPremiumCatalogueTemplate,
} from '../../lib/catalog-engine';

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
      saleWindow: { startsAt: null, endsAt: null },
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

test('catalogue export renderers produce html and pdf artifacts from engine output', () => {
  const hero = makeProduct({
    id: 'prod-hero',
    slug: 'hero-product',
    sku: 'SKU-001',
    identity: {
      name: 'Hero Product',
      shortName: 'Hero',
      poeticLine: 'Lead the premium story.',
      description: 'Hero description',
    },
    catalogue: {
      featured: true,
      editorial: true,
      pinHero: true,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Hero story block',
    },
    badges: ['FOUNDERS_EDIT'],
  });

  const supporting = makeProduct({
    id: 'prod-support',
    slug: 'support-product',
    sku: 'SKU-002',
    identity: {
      name: 'Support Product',
      shortName: 'Support',
      poeticLine: 'Supports the hero narrative.',
      description: 'Support description',
    },
    catalogue: {
      featured: true,
      editorial: false,
      pinHero: false,
      audienceTag: 'LUXURY_HOME',
      ctaMode: 'SHOP_NOW',
      storyBlock: null,
    },
  });

  const engineOutput = buildPremiumCatalogueEngine({
    brief: {
      title: 'Monsoon Edit',
      slug: 'monsoon-edit',
      tone: 'luxury',
      audienceTags: ['LUXURY_HOME'],
      featuredLimit: 2,
    },
    products: [hero, supporting],
  });

  const template = renderPremiumCatalogueTemplate(engineOutput);
  const html = renderPremiumCatalogueHtmlDocument({ engineOutput, template });
  const pdf = renderPremiumCataloguePdfBuffer({ engineOutput, template });

  assert.match(html, /Monsoon Edit/);
  assert.match(html, /Table of contents/);
  assert.match(html, /Hero Product/);
  assert.match(html, /Signature Picks|Editor Picks|Gift Picks|Launch Picks|Core Picks/);

  assert.equal(Buffer.isBuffer(pdf), true);
  assert.match(pdf.toString('utf8', 0, 8), /%PDF-1.4/);
  assert.match(pdf.toString('utf8'), /Monsoon Edit/);
});
