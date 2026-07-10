import type {
  ErpNormalizationBundle,
  ErpNormalizedInventoryPayload,
} from './contracts';
import { ERP_NORMALIZE_VERSION } from './contracts';
import { normalizeErpProductPayload } from './product';
import {
  asBoolean,
  asNumber,
  asRecord,
  asTrimmedString,
  getValue,
  normalizeQuantity,
  normalizeSku,
  toIsoString,
} from './shared';

export function normalizeErpInventoryPayload(
  raw: unknown
): ErpNormalizedInventoryPayload {
  const record = asRecord(raw);

  const sku = normalizeSku(
    getValue(record, ['sku', 'itemCode', 'productCode'])
  );

  if (!sku) {
    throw new Error('ERP inventory payload is missing sku/itemCode');
  }

  const availableQuantity = normalizeQuantity(
    getValue(record, ['availableQuantity', 'available', 'onHand', 'stock', 'inventory'])
  );

  const reservedQuantity = normalizeQuantity(
    getValue(record, ['reservedQuantity', 'reserved', 'allocated'])
  );

  const incomingQuantity = normalizeQuantity(
    getValue(record, ['incomingQuantity', 'incoming', 'inTransit'])
  );

  const lowStockThresholdNumber = asNumber(
    getValue(record, ['lowStockThreshold', 'reorderLevel', 'minStock'])
  );

  const explicitInStock = asBoolean(
    getValue(record, ['inStock', 'isInStock', 'availableFlag', 'stockStatus'])
  );

  return {
    version: ERP_NORMALIZE_VERSION,
    externalId: asTrimmedString(
      getValue(record, ['id', 'externalId', 'inventoryId'])
    ),
    sku,
    availableQuantity,
    reservedQuantity,
    incomingQuantity,
    lowStockThreshold:
      lowStockThresholdNumber === null
        ? null
        : Math.max(0, Math.trunc(lowStockThresholdNumber)),
    inStock: explicitInStock ?? availableQuantity > 0,
    updatedAt: toIsoString(
      getValue(record, ['updatedAt', 'modifiedAt', 'lastUpdatedAt', 'timestamp'])
    ),
    raw: record,
  };
}

export function buildNormalizedErpBundle(input: {
  product: unknown;
  inventory: unknown;
}): ErpNormalizationBundle {
  return {
    product: normalizeErpProductPayload(input.product),
    inventory: normalizeErpInventoryPayload(input.inventory),
  };
}
