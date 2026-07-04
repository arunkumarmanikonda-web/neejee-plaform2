import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProductReadModel,
  type ProductReadSourceRow,
} from '../../lib/catalog/product-read';

test('buildProductReadModel normalizes pricing, stock, hierarchy and catalogue fields', () => {
  const now = new Date('2026-07-04T12:00:00.000Z');

  const row: ProductReadSourceRow = {
    id: 'prod_001',
    slug: 'royal-banarasi-saree',
    sku: 'NB-001',
    name: 'Royal Banarasi Saree',
    title: 'Royal Banarasi Saree',
    shortName: 'Banarasi Saree',
    poeticLine: 'A festive weave from Varanasi',
    description: 'Handwoven silk saree with zari motifs',
    shortDescription: 'Festive silk saree',
    excerpt: 'Elegant festive drape',
    summary: 'Premium Banarasi saree',
    region: 'Varanasi',
    origin: 'India',
    status: 'ACTIVE',
    active: true,
    enabled: true,
    published: true,
    metaTitle: 'Royal Banarasi Saree',
    metaDescription: 'Handwoven Banarasi silk saree',

    craft: 'Banarasi',
    state: 'Uttar Pradesh',
    cluster: 'Varanasi',
    artisanName: 'Sharma Weaves',
    material: 'Silk',
    technique: 'Handloom',
    occasion: 'Wedding',
    story: 'Woven over several days by skilled artisans',
    craftNote: 'Store in muslin',
    careInstructions: 'Dry clean only',
    sustainabilityNote: 'Made in small artisan batches',

    mrp: 1000,
    sellingPrice: 800,
    salePrice: 700,
    saleStartsAt: '2026-01-01T00:00:00.000Z',
    saleEndsAt: '2026-12-31T23:59:59.000Z',
    gstRate: 12,
    hsnCode: '5007',

    images: [
      'https://example.com/product-main.jpg',
      'https://example.com/product-gallery.jpg',
    ],
    video: 'https://example.com/product-video.mp4',

    badges: ['Festive', 'Handmade'],
    tags: ['saree', 'banarasi'],
    labels: ['premium', 'wedding'],

    catalogueFeatured: true,
    catalogueBestseller: false,
    catalogueEditorial: true,
    cataloguePinHero: true,
    catalogueExclude: false,
    cataloguePreferredImage: 'https://example.com/preferred.jpg',
    catalogueAudienceTag: 'festive',
    catalogueCtaMode: 'SHOP_NOW',
    catalogueStoryBlock: 'Artisan spotlight',
    catalogueImageApproved: true,
    catalogueImageQualityScore: 95,
    catalogueStockVisibility: 'SHOW_ALL',

    codEligible: true,
    returnEligible: true,
    returnPolicy: '7 day returns',

    aiTryOnEligible: true,
    aiRoomEligible: false,
    arTryOnEligible: true,

    category: {
      id: 'cat_3',
      slug: 'banarasi-sarees',
      name: 'Banarasi Sarees',
      path: 'women/sarees/banarasi-sarees',
      level: 3,
      parentId: 'cat_2',
      parent: {
        id: 'cat_2',
        slug: 'sarees',
        name: 'Sarees',
        path: 'women/sarees',
        level: 2,
        parentId: 'cat_1',
        parent: {
          id: 'cat_1',
          slug: 'women',
          name: 'Women',
          path: 'women',
          level: 1,
          parentId: null,
        },
      },
    },

    variants: [
      {
        id: 'var_1',
        sku: 'NB-001-RED',
        size: 'Free Size',
        color: 'Red',
        colorHex: '#cc0000',
        material: 'Silk',
        inventory: 3,
        mrp: 1000,
        sellingPrice: 800,
        images: ['https://example.com/variant-red.jpg'],
      },
      {
        id: 'var_2',
        sku: 'NB-001-MAROON',
        size: 'Free Size',
        color: 'Maroon',
        colorHex: '#800000',
        material: 'Silk',
        inventory: 1,
        mrp: 1000,
        sellingPrice: 790,
        images: ['https://example.com/variant-maroon.jpg'],
      },
    ],

    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
  };

  const read = buildProductReadModel(row, 'catalogue', now);

  assert.equal(read.id, 'prod_001');
  assert.equal(read.slug, 'royal-banarasi-saree');
  assert.equal(read.identity.name, 'Royal Banarasi Saree');

  assert.equal(read.pricing.mrp, 1000);
  assert.equal(read.pricing.sellingPrice, 800);
  assert.equal(read.pricing.salePrice, 700);
  assert.equal(read.pricing.effectivePrice, 700);
  assert.equal(read.pricing.currency, 'INR');

  assert.equal(read.stock.inStock, true);
  assert.equal(read.stock.totalInventory, 4);
  assert.equal(read.catalogueStockVisibility, 'SHOW_ALL');

  assert.equal(read.primaryImage, 'https://example.com/preferred.jpg');
  assert.equal(read.cataloguePreferredImage, 'https://example.com/preferred.jpg');
  assert.equal(read.catalogueImageApproved, true);
  assert.equal(read.catalogueImageQualityScore, 95);

  assert.equal(read.catalogueFeatured, true);
  assert.equal(read.catalogueEditorial, true);
  assert.equal(read.cataloguePinHero, true);
  assert.equal(read.catalogueExclude, false);
  assert.equal(read.catalogueAudienceTag, 'festive');
  assert.equal(read.catalogueCtaMode, 'SHOP_NOW');
  assert.equal(read.catalogueStoryBlock, 'Artisan spotlight');

  assert.equal(read.categoryPath, 'women/sarees/banarasi-sarees');
  assert.ok(Array.isArray(read.categoryBreadcrumb));
  assert.ok(read.categoryBreadcrumb.length >= 1);
  assert.ok(Array.isArray(read.hierarchy.lineage));
  assert.ok(read.hierarchy.lineage.some((node) => node.slug === 'women'));
  assert.ok(read.hierarchy.lineage.some((node) => node.slug === 'sarees'));
  assert.ok(read.hierarchy.lineage.some((node) => node.slug === 'banarasi-sarees'));

  assert.equal(read.variants.length, 2);

  const variantSkus = read.variants.map((variant) => variant.sku);
  assert.ok(variantSkus.includes('NB-001-RED'));
  assert.ok(variantSkus.includes('NB-001-MAROON'));

  assert.ok(Array.isArray(read.catalogueReadiness.blockers));
  assert.equal(
    read.catalogueReadiness.blockers.includes('image_not_approved'),
    false
  );
});

test('buildProductReadModel respects exclusion and keeps deterministic top-level catalogue fields', () => {
  const row: ProductReadSourceRow = {
    id: 'prod_002',
    slug: 'excluded-product',
    sku: 'NB-002',
    name: 'Excluded Product',
    description: 'Should not appear in catalogue selection',
    status: 'ACTIVE',
    active: true,
    enabled: true,
    published: true,
    images: ['https://example.com/excluded.jpg'],
    mrp: 500,
    sellingPrice: 450,
    catalogueExclude: true,
    catalogueFeatured: false,
    catalogueBestseller: false,
    catalogueEditorial: false,
    cataloguePinHero: false,
    catalogueImageApproved: true,
    catalogueImageQualityScore: 80,
    catalogueStockVisibility: 'IN_STOCK_ONLY',
    category: {
      id: 'cat_simple',
      slug: 'decor',
      name: 'Decor',
      path: 'home/decor',
      level: 2,
      parentId: 'cat_home',
      parent: {
        id: 'cat_home',
        slug: 'home',
        name: 'Home',
        path: 'home',
        level: 1,
        parentId: null,
      },
    },
    variants: [
      {
        id: 'var_simple',
        sku: 'NB-002-STD',
        inventory: 2,
      },
    ],
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  };

  const read = buildProductReadModel(
    row,
    'catalogue',
    new Date('2026-07-04T00:00:00.000Z')
  );

  assert.equal(read.catalogueExclude, true);
  assert.equal(read.catalogue.exclude, true);
  assert.equal(read.catalogueFlags.exclude, true);
  assert.equal(read.catalogueStockVisibility, 'IN_STOCK_ONLY');
  assert.equal(read.stock.inStock, true);
});
