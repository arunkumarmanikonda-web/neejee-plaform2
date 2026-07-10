import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  buildNormalizedErpBundle,
  normalizeCurrencyCode,
  normalizeErpInventoryPayload,
  normalizeErpProductPayload,
} from '../../lib/erp/normalize';

const PRODUCT_PAYLOAD = {
  id: 'erp-item-1001',
  itemCode: ' nj-cer-lamp-001 ',
  productName: 'Istanbul Ceramic Mushroom Lamp',
  sellerCode: 'SELLER-001',
  status: 'enabled',
  category: 'lighting',
  currency: 'rs',
  mrp: 1499.9,
  sellingPrice: 1299.9,
  weight: '1.25',
  weightUnit: 'kg',
  length: '12.5',
  width: '10',
  height: '9',
  dimensionUnit: 'cm',
  color: 'Ivory',
  finish: 'Gloss',
  updatedAt: '2026-07-10T12:00:00Z',
};

const INVENTORY_PAYLOAD = {
  id: 'inv-1001',
  sku: 'nj-cer-lamp-001',
  onHand: '5',
  allocated: '1',
  incoming: '2',
  reorderLevel: '3',
  updatedAt: '2026-07-10T12:05:00Z',
};

describe('normalizeErpProductPayload', () => {
  it('normalizes currency, price, dimensions, and status deterministically', () => {
    const product = normalizeErpProductPayload(PRODUCT_PAYLOAD);

    assert.equal(product.sku, 'NJ-CER-LAMP-001');
    assert.equal(product.slug, 'istanbul-ceramic-mushroom-lamp');
    assert.equal(product.status, 'ACTIVE');
    assert.equal(product.price.currency, 'INR');
    assert.equal(product.price.mrpPaise, 149990);
    assert.equal(product.price.sellingPricePaise, 129990);
    assert.equal(product.dimensions.weightGrams, 1250);
    assert.equal(product.dimensions.lengthMm, 125);
  });
});

describe('normalizeErpInventoryPayload', () => {
  it('normalizes stock counters deterministically', () => {
    const inventory = normalizeErpInventoryPayload(INVENTORY_PAYLOAD);

    assert.equal(inventory.sku, 'NJ-CER-LAMP-001');
    assert.equal(inventory.availableQuantity, 5);
    assert.equal(inventory.reservedQuantity, 1);
    assert.equal(inventory.incomingQuantity, 2);
    assert.equal(inventory.lowStockThreshold, 3);
    assert.equal(inventory.inStock, true);
  });
});

describe('buildNormalizedErpBundle', () => {
  it('matches the golden file exactly', () => {
    const fixtureUrl = new URL('./fixtures/erp-normalize.golden.json', import.meta.url);
    const golden = JSON.parse(readFileSync(fixtureUrl, 'utf8')) as {
      bundle: unknown;
    };

    const bundle = buildNormalizedErpBundle({
      product: PRODUCT_PAYLOAD,
      inventory: INVENTORY_PAYLOAD,
    });

    assert.deepEqual(bundle, golden.bundle);
  });
});

describe('normalizeCurrencyCode', () => {
  it('maps common ERP currency aliases into platform codes', () => {
    assert.equal(normalizeCurrencyCode('rs'), 'INR');
    assert.equal(normalizeCurrencyCode('$'), 'USD');
    assert.equal(normalizeCurrencyCode('EUR'), 'EUR');
  });
});
