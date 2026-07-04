import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CATALOGUE_EXPORT_VERSION,
  buildCatalogueExportPayload,
  buildCatalogueExportProduct,
  buildCatalogueExportProducts,
} from '../../lib/catalog/export';
import type { ProductReadModel } from '../../lib/catalog/product-read';

function makeProduct(
  overrides: Record<string, unknown> = {}
): ProductReadModel {
  const base = {
    id: 'prod-default',
    slug: 'default-product',
    sku: 'SKU-DEFAULT',
    source: 'catalogue',
    status: 'ACTIVE',
    active: true,
    enabled: true,
    published: true,

    name: 'Default Product',
    title: 'Default Product',
    shortDescription: 'Short description',
    description: 'Long description',
    summary: 'Summary',
    excerpt: 'Excerpt',

    metaTitle: 'SEO title',
    metaDescription: 'SEO description',

    identity: {
      id: 'prod-default',
      slug: 'default-product',
      sku: 'SKU-DEFAULT',
      name: 'Default Product',
      title: 'Default Product',
      shortName: 'Default',
      poeticLine: null,
      status: 'ACTIVE',
      active: true,
      enabled: true,
      published: true,
    },

    craft: {
      craft: 'Banarasi',
      region: 'Varanasi',
      state: 'Uttar Pradesh',
      cluster: 'Varanasi',
      artisanName: 'Artisan House',
      material: 'Silk',
      technique: 'Handloom',
      occasion: 'Festive',
      story: 'Craft story',
      craftNote: 'Craft note',
      careInstructions: 'Dry clean only',
      sustainabilityNote: 'Small batch',
    },

    category: {
      id: 'cat_1',
      slug: 'banarasi',
      name: 'Banarasi',
      path: 'women/sarees/banarasi',
      level: 3,
    },

    hierarchy: {
      path: 'women/sarees/banarasi',
      depth: 3,
      lineage: [
        { id: 'cat_root', slug: 'women', name: 'Women', path: 'women', level: 1 },
        { id: 'cat_mid', slug: 'sarees', name: 'Sarees', path: 'women/sarees', level: 2 },
        {
          id: 'cat_1',
          slug: 'banarasi',
          name: 'Banarasi',
          path: 'women/sarees/banarasi',
          level: 3,
        },
      ],
      mainCategory: {
        id: 'cat_root',
        slug: 'women',
        name: 'Women',
        path: 'women',
        level: 1,
      },
      subCategory: {
        id: 'cat_mid',
        slug: 'sarees',
        name: 'Sarees',
        path: 'women/sarees',
        level: 2,
      },
      subSubCategory: null,
      leafCategory: {
        id: 'cat_1',
        slug: 'banarasi',
        name: 'Banarasi',
        path: 'women/sarees/banarasi',
        level: 3,
      },
    },

    categoryPath: 'women/sarees/banarasi',
    categoryLevel: 3,
    categoryBreadcrumb: ['Women', 'Sarees', 'Banarasi'],
    breadcrumbs: [],
    mainCategory: {
      id: 'cat_root',
      slug: 'women',
      name: 'Women',
      path: 'women',
      level: 1,
    },
    subCategory: {
      id: 'cat_mid',
      slug: 'sarees',
      name: 'Sarees',
      path: 'women/sarees',
      level: 2,
    },
    subSubCategory: null,
    leafCategory: {
      id: 'cat_1',
      slug: 'banarasi',
      name: 'Banarasi',
      path: 'women/sarees/banarasi',
      level: 3,
    },

    primaryImage: 'https://example.com/primary.jpg',
    image: 'https://example.com/primary.jpg',
    images: ['https://example.com/primary.jpg'],
    gallery: ['https://example.com/primary.jpg', 'https://example.com/gallery.jpg'],
    productImages: ['https://example.com/primary.jpg', 'https://example.com/gallery.jpg'],
    variantImages: ['https://example.com/variant.jpg'],
    media: {
      primaryImage: 'https://example.com/primary.jpg',
      approvedPrimaryImage: 'https://example.com/approved.jpg',
      preferredImage: 'https://example.com/preferred.jpg',
      gallery: ['https://example.com/primary.jpg', 'https://example.com/gallery.jpg'],
      approvedGallery: ['https://example.com/approved.jpg'],
      productImages: ['https://example.com/primary.jpg', 'https://example.com/gallery.jpg'],
      variantImages: ['https://example.com/variant.jpg'],
      video: 'https://example.com/video.mp4',
      imageApproved: true,
      imageQualityScore: 92,
      hasMedia: true,
      hasApprovedMedia: true,
      selectionMode: 'preferred',
      selectionSource: 'cataloguePreferredImage',
      fallbackApplied: false,
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
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-12-31T23:59:59.000Z',
        active: true,
      },
    },

    stock: {
      inStock: true,
      lowStock: false,
      totalInventory: 4,
      availableQuantity: 4,
      stockVisibility: 'SHOW_ALL',
      showExactQuantity: true,
      purchasable: true,
      label: '4 available',
    },

    catalogue: {
      featured: true,
      bestseller: false,
      editorial: true,
      pinHero: true,
      exclude: false,
      audienceTag: 'festive',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Artisan spotlight',
      preferredImage: 'https://example.com/preferred.jpg',
      imageApproved: true,
      imageQualityScore: 92,
      stockVisibility: 'SHOW_ALL',
      readiness: {
        readyForCatalogue: true,
        visibleInFeed: true,
        usesApprovedMedia: true,
        blockers: [],
      },
    },

    catalogueFlags: {
      featured: true,
      bestseller: false,
      editorial: true,
      pinHero: true,
      exclude: false,
      audienceTag: 'festive',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Artisan spotlight',
    },

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
    catalogueImageQualityScore: 92,
    catalogueStockVisibility: 'SHOW_ALL',
    catalogueReadiness: {
      readyForCatalogue: true,
      visibleInFeed: true,
      usesApprovedMedia: true,
      blockers: [],
    },

    badges: ['Festive', 'Handmade'],
    tags: ['saree', 'banarasi'],
    labels: ['premium'],

    policies: {
      codEligible: true,
      returnEligible: true,
      returnPolicy: '7 day returns',
    },
    purchase: {
      codEligible: true,
      returnEligible: true,
      returnPolicy: '7 day returns',
    },
    commerce: {
      codEligible: true,
      returnEligible: true,
      returnPolicy: '7 day returns',
    },

    codEligible: true,
    returnEligible: true,
    returnPolicy: '7 day returns',

    ai: {
      tryOnEligible: true,
      roomEligible: false,
      arTryOnEligible: true,
      mirrorEligible: true,
    },
    aiTryOnEligible: true,
    aiRoomEligible: false,
    arTryOnEligible: true,
    mirrorEligible: true,

    fulfilment: {
      mode: 'IN_STOCK',
      depositPercent: null,
      releaseDate: null,
      editionSize: null,
      editionSold: null,
    },

    variants: [
      {
        id: 'var_1',
        sku: 'SKU-DEFAULT-RED',
        size: 'Free Size',
        color: 'Red',
        colorHex: '#cc0000',
        material: 'Silk',
        inventory: 4,
        pricing: {
          mrp: 1000,
          sellingPrice: 800,
          salePrice: 700,
        },
        stock: {
          inStock: true,
          totalInventory: 4,
        },
        images: ['https://example.com/variant.jpg'],
      },
    ],

    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
    timestamps: {
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-03T00:00:00.000Z'),
    },
  };

  return {
    ...base,
    ...overrides,
  } as unknown as ProductReadModel;
}

test('buildCatalogueExportProduct maps a product into stable export shape', () => {
  const product = makeProduct({
    id: 'prod_export_1',
    slug: 'export-product-one',
    sku: 'EXP-001',
  });

  const exported = buildCatalogueExportProduct(product);

  assert.equal(exported.version, CATALOGUE_EXPORT_VERSION);
  assert.equal(exported.id, 'prod_export_1');
  assert.equal(exported.slug, 'export-product-one');
  assert.equal(exported.media.preferredImage, 'https://example.com/preferred.jpg');
  assert.equal(exported.media.imageApproved, true);
  assert.equal(exported.pricing.effectivePrice, 700);
  assert.equal(exported.stock.stockVisibility, 'SHOW_ALL');
  assert.equal(exported.catalogue.pinHero, true);
  assert.equal(exported.catalogue.readiness.readyForCatalogue, true);
  assert.equal(exported.hierarchy.path, 'women/sarees/banarasi');
  assert.equal(exported.variants.length, 1);
  assert.equal(exported.variants[0]?.sku, 'SKU-DEFAULT-RED');
});

test('buildCatalogueExportProducts sorts deterministically by slug then sku then id', () => {
  const c = makeProduct({ id: '3', slug: 'c-product', sku: 'C-001' });
  const a2 = makeProduct({ id: '2', slug: 'a-product', sku: 'A-002' });
  const a1 = makeProduct({ id: '1', slug: 'a-product', sku: 'A-001' });

  const result = buildCatalogueExportProducts([c, a2, a1]);

  assert.deepEqual(
    result.map((item) => item.sku),
    ['A-001', 'A-002', 'C-001']
  );
});

test('buildCatalogueExportPayload uses selector ordering and excludes excluded products', () => {
  const pinned = makeProduct({
    id: 'prod_pinned',
    slug: 'pinned-product',
    sku: 'PIN-001',
    cataloguePinHero: true,
    catalogue: {
      featured: true,
      bestseller: false,
      editorial: true,
      pinHero: true,
      exclude: false,
      audienceTag: 'festive',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Pinned hero',
      preferredImage: 'https://example.com/pinned-preferred.jpg',
      imageApproved: true,
      imageQualityScore: 99,
      stockVisibility: 'SHOW_ALL',
      readiness: {
        readyForCatalogue: true,
        visibleInFeed: true,
        usesApprovedMedia: true,
        blockers: [],
      },
    },
    catalogueFlags: {
      featured: true,
      bestseller: false,
      editorial: true,
      pinHero: true,
      exclude: false,
      audienceTag: 'festive',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Pinned hero',
    },
    cataloguePreferredImage: 'https://example.com/pinned-preferred.jpg',
    catalogueAudienceTag: 'festive',
    updatedAt: new Date('2026-07-04T00:00:00.000Z'),
  });

  const regular = makeProduct({
    id: 'prod_regular',
    slug: 'regular-product',
    sku: 'REG-001',
    cataloguePinHero: false,
    catalogueFeatured: false,
    catalogueEditorial: false,
    catalogue: {
      featured: false,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: 'festive',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Regular',
      preferredImage: 'https://example.com/regular-preferred.jpg',
      imageApproved: true,
      imageQualityScore: 80,
      stockVisibility: 'SHOW_ALL',
      readiness: {
        readyForCatalogue: true,
        visibleInFeed: true,
        usesApprovedMedia: true,
        blockers: [],
      },
    },
    catalogueFlags: {
      featured: false,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: 'festive',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Regular',
    },
    catalogueAudienceTag: 'festive',
  });

  const excluded = makeProduct({
    id: 'prod_excluded',
    slug: 'excluded-product',
    sku: 'EXC-001',
    catalogueExclude: true,
    catalogue: {
      featured: false,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: true,
      audienceTag: 'festive',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Excluded',
      preferredImage: 'https://example.com/excluded.jpg',
      imageApproved: true,
      imageQualityScore: 60,
      stockVisibility: 'SHOW_ALL',
      readiness: {
        readyForCatalogue: true,
        visibleInFeed: false,
        usesApprovedMedia: true,
        blockers: [],
      },
    },
    catalogueFlags: {
      featured: false,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: true,
      audienceTag: 'festive',
      ctaMode: 'SHOP_NOW',
      storyBlock: 'Excluded',
    },
    catalogueAudienceTag: 'festive',
  });

  const payload = buildCatalogueExportPayload({
    products: [regular, excluded, pinned],
    categoryPath: 'women/sarees',
    campaignKey: 'festive',
    generatedAt: '2026-07-04T12:00:00.000Z',
  });

  assert.equal(payload.version, CATALOGUE_EXPORT_VERSION);
  assert.equal(payload.generatedAt, '2026-07-04T12:00:00.000Z');
  assert.equal(payload.selection.totalInput, 3);
  assert.equal(payload.selection.totalMatched, 3);
  assert.equal(payload.selection.totalEligible, 2);
  assert.deepEqual(payload.selection.excludedProductIds, ['prod_excluded']);
  assert.equal(payload.selection.heroProductId, 'prod_pinned');
  assert.deepEqual(payload.selection.orderedProductIds, ['prod_pinned', 'prod_regular']);
  assert.equal(payload.products.length, 2);
  assert.equal(payload.products[0]?.id, 'prod_pinned');
  assert.equal(payload.products[1]?.id, 'prod_regular');
});
