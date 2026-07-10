import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ERP_RECONCILIATION_VERSION,
  buildErpReconciliationRows,
  buildPlatformReconciliationRows,
  createErpReconciliationResponse,
  filterReconciliationItems,
  normalizePlatformStatus,
  normalizeReconciliationFilter,
  reconcilePlatformVsErp,
} from '../../lib/erp/reconciliation';

describe('ERP reconciliation helpers', () => {
  it('exposes a stable version', () => {
    assert.equal(ERP_RECONCILIATION_VERSION, 'phase3.erp-reconciliation.v1');
  });

  it('normalizes platform statuses into reconciliation statuses', () => {
    assert.equal(normalizePlatformStatus('ACTIVE'), 'ACTIVE');
    assert.equal(normalizePlatformStatus('DRAFT'), 'DRAFT');
    assert.equal(normalizePlatformStatus('PENDING_QC'), 'DRAFT');
    assert.equal(normalizePlatformStatus('ARCHIVED'), 'INACTIVE');
  });

  it('normalizes reconciliation filters safely', () => {
    assert.equal(normalizeReconciliationFilter('drift'), 'DRIFT');
    assert.equal(normalizeReconciliationFilter('MISSING_IN_ERP'), 'MISSING_IN_ERP');
    assert.equal(normalizeReconciliationFilter('bogus'), 'ALL');
    assert.equal(normalizeReconciliationFilter(null), 'ALL');
  });

  it('builds platform and ERP rows deterministically', () => {
    const platformRows = buildPlatformReconciliationRows([
      {
        id: 'prod-1',
        sku: 'sku-1',
        slug: 'sku-1',
        name: 'Product One',
        status: 'ACTIVE',
        mrp: 10000,
        sellingPrice: 9000,
        updatedAt: '2026-07-10T00:00:00.000Z',
        variants: [{ inventory: 3 }, { inventory: 2 }],
      },
    ]);

    const erpRows = buildErpReconciliationRows(
      [
        {
          sku: 'sku-1',
          name: 'Product One ERP',
          status: 'ACTIVE',
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
      ],
      {
        'SKU-1': {
          mrpPaise: 10000,
          sellingPricePaise: 9000,
        },
      },
      {
        'SKU-1': {
          availableQuantity: 5,
        },
      }
    );

    assert.equal(platformRows[0].sku, 'SKU-1');
    assert.equal(platformRows[0].inventoryQuantity, 5);
    assert.equal(erpRows[0].sku, 'SKU-1');
    assert.equal(erpRows[0].inventoryQuantity, 5);
  });

  it('reconciles matched, drift, and missing rows correctly', () => {
    const items = reconcilePlatformVsErp(
      [
        {
          productId: 'prod-1',
          sku: 'SKU-1',
          slug: 'sku-1',
          name: 'Matched',
          status: 'ACTIVE',
          mrpPaise: 10000,
          sellingPricePaise: 9000,
          inventoryQuantity: 5,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
        {
          productId: 'prod-2',
          sku: 'SKU-2',
          slug: 'sku-2',
          name: 'Drifted',
          status: 'ACTIVE',
          mrpPaise: 12000,
          sellingPricePaise: 10000,
          inventoryQuantity: 4,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
        {
          productId: 'prod-3',
          sku: 'SKU-3',
          slug: 'sku-3',
          name: 'Only platform',
          status: 'DRAFT',
          mrpPaise: 5000,
          sellingPricePaise: 4000,
          inventoryQuantity: 0,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
      ],
      [
        {
          sku: 'SKU-1',
          name: 'Matched ERP',
          status: 'ACTIVE',
          mrpPaise: 10000,
          sellingPricePaise: 9000,
          inventoryQuantity: 5,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
        {
          sku: 'SKU-2',
          name: 'Drifted ERP',
          status: 'INACTIVE',
          mrpPaise: 12500,
          sellingPricePaise: 9900,
          inventoryQuantity: 3,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
        {
          sku: 'SKU-4',
          name: 'Only ERP',
          status: 'ACTIVE',
          mrpPaise: 8000,
          sellingPricePaise: 7000,
          inventoryQuantity: 2,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
      ]
    );

    assert.deepEqual(
      items.map((item) => [item.sku, item.kind]),
      [
        ['SKU-3', 'MISSING_IN_ERP'],
        ['SKU-4', 'MISSING_IN_PLATFORM'],
        ['SKU-2', 'DRIFT'],
        ['SKU-1', 'MATCHED'],
      ]
    );

    const driftItem = items.find((item) => item.sku === 'SKU-2');
    assert.deepEqual(driftItem?.mismatches, [
      'STATUS',
      'SELLING_PRICE',
      'MRP',
      'INVENTORY',
    ]);
  });

  it('creates a filtered reconciliation response with stable summary counts', () => {
    const response = createErpReconciliationResponse({
      generatedAt: '2026-07-10T00:00:00.000Z',
      adapterKind: 'mock',
      filter: 'DRIFT',
      limit: 50,
      platformRows: [
        {
          productId: 'prod-1',
          sku: 'SKU-1',
          slug: 'sku-1',
          name: 'A',
          status: 'ACTIVE',
          mrpPaise: 10000,
          sellingPricePaise: 9000,
          inventoryQuantity: 5,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
      ],
      erpRows: [
        {
          sku: 'SKU-1',
          name: 'A ERP',
          status: 'INACTIVE',
          mrpPaise: 10000,
          sellingPricePaise: 9500,
          inventoryQuantity: 5,
          updatedAt: '2026-07-10T00:00:00.000Z',
        },
      ],
    });

    assert.equal(response.filter, 'DRIFT');
    assert.equal(response.summary.total, 1);
    assert.equal(response.summary.drift, 1);
    assert.equal(response.summary.statusMismatchCount, 1);
    assert.equal(response.summary.sellingPriceMismatchCount, 1);
    assert.equal(response.items.length, 1);
    assert.equal(response.items[0].kind, 'DRIFT');

    assert.equal(filterReconciliationItems(response.items, 'MATCHED').length, 0);
  });
});
