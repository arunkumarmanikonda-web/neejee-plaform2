import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  getErpAdapter,
  mockErpAdapter,
  resolveErpAdapterKind,
} from '../../lib/erp/adapter';

const ORIGINAL_ERP_ADAPTER = process.env.ERP_ADAPTER;

afterEach(() => {
  if (typeof ORIGINAL_ERP_ADAPTER === 'string') {
    process.env.ERP_ADAPTER = ORIGINAL_ERP_ADAPTER;
  } else {
    delete process.env.ERP_ADAPTER;
  }
});

describe('resolveErpAdapterKind', () => {
  it('defaults to mock when env is missing', () => {
    assert.equal(resolveErpAdapterKind(undefined), 'mock');
  });

  it('returns mock for unknown values', () => {
    assert.equal(resolveErpAdapterKind('something-else'), 'mock');
  });

  it('returns real for explicit real', () => {
    assert.equal(resolveErpAdapterKind('real'), 'real');
  });
});

describe('getErpAdapter', () => {
  it('returns mock adapter by default', () => {
    delete process.env.ERP_ADAPTER;

    const adapter = getErpAdapter();

    assert.equal(adapter.kind, 'mock');
  });

  it('returns mock adapter for explicit mock', () => {
    process.env.ERP_ADAPTER = 'mock';

    const adapter = getErpAdapter();

    assert.equal(adapter.kind, 'mock');
  });

  it('throws for real adapter until implemented', () => {
    process.env.ERP_ADAPTER = 'real';

    assert.throws(
      () => getErpAdapter(),
      /Real ERP adapter not implemented yet/
    );
  });
});

describe('mockErpAdapter', () => {
  it('lists products deterministically', async () => {
    const first = await mockErpAdapter.listProducts();
    const second = await mockErpAdapter.listProducts();

    assert.deepEqual(first, second);
    assert.deepEqual(
      first.map((product) => product.sku),
      ['NJ-CER-LAMP-001', 'NJ-TXT-THROW-002']
    );
  });

  it('gets product by sku', async () => {
    const product = await mockErpAdapter.getProductBySku('NJ-CER-LAMP-001');

    assert.ok(product);
    assert.equal(product.slug, 'istanbul-ceramic-mushroom-lamp');
    assert.equal(product.sellerId, 'seller-001');
  });

  it('gets stock by sku', async () => {
    const stock = await mockErpAdapter.getStockBySku('NJ-CER-LAMP-001');

    assert.ok(stock);
    assert.equal(stock.availableQuantity, 5);
    assert.equal(stock.reservedQuantity, 1);
    assert.equal(stock.inStock, true);
  });

  it('gets price by sku', async () => {
    const price = await mockErpAdapter.getPriceBySku('NJ-TXT-THROW-002');

    assert.ok(price);
    assert.equal(price.currency, 'INR');
    assert.equal(price.mrpPaise, 99990);
    assert.equal(price.effectivePricePaise, 89990);
    assert.equal(price.onSale, true);
  });

  it('lists sellers deterministically', async () => {
    const sellers = await mockErpAdapter.listSellers();

    assert.deepEqual(
      sellers.map((seller) => seller.id),
      ['seller-001', 'seller-002']
    );
  });

  it('gets sales order deterministically', async () => {
    const order = await mockErpAdapter.getSalesOrder('SO-2026-0001');

    assert.ok(order);
    assert.equal(order.status, 'PLACED');
    assert.equal(order.lines.length, 1);
    assert.equal(order.lines[0]?.sku, 'NJ-CER-LAMP-001');
  });

  it('gets purchase order deterministically', async () => {
    const purchaseOrder = await mockErpAdapter.getPurchaseOrder('PO-2026-0001');

    assert.ok(purchaseOrder);
    assert.equal(purchaseOrder.status, 'CONFIRMED');
    assert.equal(purchaseOrder.lines.length, 2);
    assert.equal(purchaseOrder.lines[1]?.sku, 'NJ-TXT-THROW-002');
  });
});
