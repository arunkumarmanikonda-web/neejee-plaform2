import test from 'node:test';
import assert from 'node:assert/strict';

import {
  orderCatalogueGallery,
  selectCatalogueProducts,
  selectHeroProduct,
  type CatalogueSelectorProduct,
} from '../../lib/catalog/selectors';

function makeProduct(
  overrides: Record<string, unknown> = {}
): CatalogueSelectorProduct {
  const base = {
    id: 'prod-default',
    slug: 'default-product',
    sku: 'SKU-DEFAULT',
    name: 'Default Product',
    title: 'Default Product',
    primaryImage: 'https://example.com/default.jpg',
    image: 'https://example.com/default.jpg',
    categoryPath: 'women/sarees',
    category: {
      slug: 'sarees',
      path: 'women/sarees',
      name: 'Sarees',
      level: 2,
    },
    hierarchy: {
      path: 'women/sarees',
      lineage: [
        { slug: 'women', name: 'Women', path: 'women', level: 1 },
        { slug: 'sarees', name: 'Sarees', path: 'women/sarees', level: 2 },
      ],
      leafCategory: {
        slug: 'sarees',
        name: 'Sarees',
        path: 'women/sarees',
        level: 2,
      },
    },
    catalogue: {
      featured: false,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: null,
      preferredImage: null,
      imageApproved: true,
      imageQualityScore: 70,
    },
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
    catalogueAudienceTag: null,
    cataloguePreferredImage: null,
    catalogueImageApproved: true,
    catalogueImageQualityScore: 70,
    stock: {
      inStock: true,
      totalInventory: 5,
    },
    inStock: true,
    inventory: 5,
    pricing: {
      effectivePrice: 1000,
    },
    updatedAt: '2026-07-04T00:00:00.000Z',
    badges: [],
  };

  return {
    ...base,
    ...overrides,
  } as unknown as CatalogueSelectorProduct;
}

test('selectCatalogueProducts excludes excluded products and reports excluded ids', () => {
  const included = makeProduct({
    id: 'prod-1',
    slug: 'included-product',
  });

  const excluded = makeProduct({
    id: 'prod-2',
    slug: 'excluded-product',
    catalogueExclude: true,
    catalogue: {
      exclude: true,
    },
    catalogueFlags: {
      exclude: true,
    },
  });

  const result = selectCatalogueProducts({
    products: [included, excluded],
  });

  assert.equal(result.totalInput, 2);
  assert.equal(result.totalMatched, 2);
  assert.equal(result.totalEligible, 1);
  assert.deepEqual(result.excludedProductIds, ['prod-2']);
  assert.equal(result.orderedProducts.length, 1);
  assert.equal(result.orderedProducts[0]?.id, 'prod-1');
});

test('selectHeroProduct prefers pinned hero products over other products', () => {
  const featured = makeProduct({
    id: 'prod-featured',
    slug: 'featured-product',
    catalogueFeatured: true,
    catalogue: {
      featured: true,
    },
    updatedAt: '2026-07-04T00:00:00.000Z',
  });

  const pinned = makeProduct({
    id: 'prod-pinned',
    slug: 'pinned-product',
    cataloguePinHero: true,
    catalogue: {
      pinHero: true,
    },
    updatedAt: '2026-06-01T00:00:00.000Z',
  });

  const hero = selectHeroProduct([featured, pinned]);

  assert.equal(hero?.id, 'prod-pinned');
});

test('selectCatalogueProducts respects category, campaign and limit', () => {
  const festive = makeProduct({
    id: 'prod-festive',
    slug: 'festive-product',
    categoryPath: 'women/sarees/banarasi',
    category: {
      slug: 'banarasi',
      path: 'women/sarees/banarasi',
      name: 'Banarasi',
      level: 3,
    },
    hierarchy: {
      path: 'women/sarees/banarasi',
      lineage: [
        { slug: 'women', name: 'Women', path: 'women', level: 1 },
        { slug: 'sarees', name: 'Sarees', path: 'women/sarees', level: 2 },
        { slug: 'banarasi', name: 'Banarasi', path: 'women/sarees/banarasi', level: 3 },
      ],
      leafCategory: {
        slug: 'banarasi',
        name: 'Banarasi',
        path: 'women/sarees/banarasi',
        level: 3,
      },
    },
    catalogueAudienceTag: 'festive',
    catalogueFlags: {
      featured: true,
      bestseller: false,
      editorial: false,
      pinHero: false,
      exclude: false,
      audienceTag: 'festive',
      ctaMode: null,
      storyBlock: null,
    },
    catalogueFeatured: true,
    badges: ['festive'],
  });

  const festiveTwo = makeProduct({
    id: 'prod-festive-2',
    slug: 'festive-product-2',
    categoryPath: 'women/sarees/banarasi',
    category: {
      slug: 'banarasi',
      path: 'women/sarees/banarasi',
      name: 'Banarasi',
      level: 3,
    },
    hierarchy: {
      path: 'women/sarees/banarasi',
      lineage: [
        { slug: 'women', name: 'Women', path: 'women', level: 1 },
        { slug: 'sarees', name: 'Sarees', path: 'women/sarees', level: 2 },
        { slug: 'banarasi', name: 'Banarasi', path: 'women/sarees/banarasi', level: 3 },
      ],
      leafCategory: {
        slug: 'banarasi',
        name: 'Banarasi',
        path: 'women/sarees/banarasi',
        level: 3,
      },
    },
    catalogueAudienceTag: 'festive',
    badges: ['festive'],
    pricing: {
      effectivePrice: 900,
    },
  });

  const other = makeProduct({
    id: 'prod-other',
    slug: 'other-product',
    categoryPath: 'home/decor',
    category: {
      slug: 'decor',
      path: 'home/decor',
      name: 'Decor',
      level: 2,
    },
    hierarchy: {
      path: 'home/decor',
      lineage: [
        { slug: 'home', name: 'Home', path: 'home', level: 1 },
        { slug: 'decor', name: 'Decor', path: 'home/decor', level: 2 },
      ],
      leafCategory: {
        slug: 'decor',
        name: 'Decor',
        path: 'home/decor',
        level: 2,
      },
    },
    catalogueAudienceTag: 'everyday',
    badges: ['everyday'],
  });

  const result = selectCatalogueProducts({
    products: [festiveTwo, other, festive],
    categoryPath: 'women/sarees',
    categorySlug: 'banarasi',
    campaignKey: 'festive',
    limit: 1,
  });

  assert.equal(result.totalInput, 3);
  assert.equal(result.totalMatched, 2);
  assert.equal(result.totalEligible, 2);
  assert.equal(result.orderedProducts.length, 1);
  assert.equal(result.orderedProducts[0]?.id, 'prod-festive');
  assert.equal(result.heroProduct?.id, 'prod-festive');
});

test('orderCatalogueGallery returns mapped gallery items in deterministic order', () => {
  const lowQuality = makeProduct({
    id: 'prod-low',
    slug: 'low-quality',
    catalogueImageQualityScore: 50,
    cataloguePreferredImage: 'https://example.com/low-preferred.jpg',
    pricing: { effectivePrice: 800 },
    updatedAt: '2026-07-03T00:00:00.000Z',
  });

  const highQuality = makeProduct({
    id: 'prod-high',
    slug: 'high-quality',
    catalogueImageQualityScore: 95,
    cataloguePreferredImage: 'https://example.com/high-preferred.jpg',
    pricing: { effectivePrice: 1200 },
    updatedAt: '2026-07-04T00:00:00.000Z',
  });

  const gallery = orderCatalogueGallery([lowQuality, highQuality]);

  assert.equal(gallery.length, 2);
  assert.equal(gallery[0]?.id, 'prod-high');
  assert.equal(gallery[0]?.preferredImage, 'https://example.com/high-preferred.jpg');
  assert.equal(gallery[0]?.imageQualityScore, 95);
  assert.equal(gallery[1]?.id, 'prod-low');
});
