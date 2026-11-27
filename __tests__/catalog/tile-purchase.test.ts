import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductReadModel, type ProductReadSourceRow } from '../../lib/catalog/product-read';
import { mapPublicProductDetail } from '../../lib/catalog/public-product-detail';

test('tile options retain individual availability, inherited prices and stock privacy', () => {
  const variants = [
    { id: 'small', inventory: 0, sellingPrice: null },
    { id: 'medium', inventory: 2, sellingPrice: null },
    { id: 'large', inventory: 3, sellingPrice: 540000 },
  ];
  for (const visibility of ['SHOW_ALL', 'HIDE_STOCK']) {
    const row = { id: 'suit', sellingPrice: 500000, catalogueStockVisibility: visibility, variants } as ProductReadSourceRow;
    const product = mapPublicProductDetail(row, buildProductReadModel(row));
    assert.deepEqual(product.variants.map((v: { inStock: boolean }) => v.inStock), [false, true, true]);
    assert.deepEqual(product.variants.map((v: { sellingPrice: number | null }) => v.sellingPrice), [null, null, 540000]);
    assert.deepEqual(product.variants.map((v: { inventory: number | null }) => v.inventory), visibility === 'SHOW_ALL' ? [0, 2, 3] : [null, null, null]);
  }
});
