import type {
  ErpNormalizedDimensions,
  ErpNormalizedPriceBlock,
  ErpNormalizedProductPayload,
} from './contracts';
import { ERP_NORMALIZE_VERSION } from './contracts';
import {
  asRecord,
  asTrimmedString,
  getValue,
  normalizeCurrencyCode,
  normalizeDimensionMm,
  normalizeMoneyToPaise,
  normalizeProductStatus,
  normalizeSku,
  normalizeWeightGrams,
  slugify,
  toIsoString,
} from './shared';

const ATTRIBUTE_KEYS = [
  'color',
  'finish',
  'material',
  'collection',
  'style',
  'taxCode',
] as const;

function firstDefined<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return null;
}

function buildPriceBlock(record: Record<string, unknown>): ErpNormalizedPriceBlock {
  const currency = normalizeCurrencyCode(
    getValue(record, ['currency', 'currencyCode', 'curr']),
    'INR'
  );

  const mrpPaise =
    firstDefined(
      getValue(record, ['mrpPaise', 'mrp_paise', 'listPricePaise']),
      getValue(record, ['mrp', 'listPrice', 'mrpAmount'])
    ) === getValue(record, ['mrpPaise', 'mrp_paise', 'listPricePaise'])
      ? normalizeMoneyToPaise(
          getValue(record, ['mrpPaise', 'mrp_paise', 'listPricePaise']),
          'paise'
        ).amountPaise
      : normalizeMoneyToPaise(
          getValue(record, ['mrp', 'listPrice', 'mrpAmount']),
          'rupees'
        ).amountPaise;

  const sellingPricePaise =
    firstDefined(
      getValue(record, [
        'sellingPricePaise',
        'selling_price_paise',
        'salePricePaise',
      ]),
      getValue(record, ['sellingPrice', 'salePrice', 'price', 'offerPrice'])
    ) ===
    getValue(record, ['sellingPricePaise', 'selling_price_paise', 'salePricePaise'])
      ? normalizeMoneyToPaise(
          getValue(record, [
            'sellingPricePaise',
            'selling_price_paise',
            'salePricePaise',
          ]),
          'paise'
        ).amountPaise
      : normalizeMoneyToPaise(
          getValue(record, ['sellingPrice', 'salePrice', 'price', 'offerPrice']),
          'rupees'
        ).amountPaise;

  const safeMrpPaise = mrpPaise;
  const safeSellingPricePaise =
    sellingPricePaise > 0 ? sellingPricePaise : safeMrpPaise;

  return {
    currency,
    mrpPaise: safeMrpPaise,
    sellingPricePaise: safeSellingPricePaise,
    effectivePricePaise: safeSellingPricePaise,
    onSale:
      safeMrpPaise > 0 &&
      safeSellingPricePaise > 0 &&
      safeSellingPricePaise < safeMrpPaise,
  };
}

function buildDimensions(record: Record<string, unknown>): ErpNormalizedDimensions {
  const weightUnit = getValue(record, ['weightUnit', 'weightUom']);
  const dimensionUnit = getValue(record, ['dimensionUnit', 'dimensionUom', 'sizeUnit']);

  return {
    weightGrams: firstDefined(
      normalizeWeightGrams(getValue(record, ['weightGrams', 'weight_g']), 'g'),
      normalizeWeightGrams(getValue(record, ['weight', 'shippingWeight']), weightUnit)
    ),
    lengthMm: firstDefined(
      normalizeDimensionMm(getValue(record, ['lengthMm']), 'mm'),
      normalizeDimensionMm(getValue(record, ['length']), dimensionUnit)
    ),
    widthMm: firstDefined(
      normalizeDimensionMm(getValue(record, ['widthMm']), 'mm'),
      normalizeDimensionMm(getValue(record, ['width']), dimensionUnit)
    ),
    heightMm: firstDefined(
      normalizeDimensionMm(getValue(record, ['heightMm']), 'mm'),
      normalizeDimensionMm(getValue(record, ['height']), dimensionUnit)
    ),
  };
}

function buildAttributes(record: Record<string, unknown>): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const key of ATTRIBUTE_KEYS) {
    const value = asTrimmedString(record[key]);

    if (value) {
      attributes[key] = value;
    }
  }

  const nestedAttributes = asRecord(record.attributes);

  for (const [key, value] of Object.entries(nestedAttributes)) {
    const normalizedValue = asTrimmedString(value);

    if (!normalizedValue) {
      continue;
    }

    attributes[key] = normalizedValue;
  }

  return attributes;
}

export function normalizeErpProductPayload(
  raw: unknown
): ErpNormalizedProductPayload {
  const record = asRecord(raw);

  const sku = normalizeSku(
    getValue(record, ['sku', 'itemCode', 'code', 'productCode'])
  );

  if (!sku) {
    throw new Error('ERP product payload is missing sku/itemCode');
  }

  const name =
    asTrimmedString(getValue(record, ['name', 'title', 'productName', 'itemName'])) ??
    sku;

  const slug =
    slugify(getValue(record, ['slug', 'productSlug']), name) || slugify(name, sku);

  return {
    version: ERP_NORMALIZE_VERSION,
    externalId: asTrimmedString(
      getValue(record, ['id', 'externalId', 'productId', 'itemId'])
    ),
    sku,
    slug,
    name,
    sellerCode: asTrimmedString(
      getValue(record, ['sellerCode', 'sellerId', 'merchantCode', 'vendorCode'])
    ),
    status: normalizeProductStatus(
      getValue(record, ['status', 'productStatus', 'state', 'enabled'])
    ),
    categoryCode: asTrimmedString(
      getValue(record, ['categoryCode', 'category', 'categoryId'])
    ),
    price: buildPriceBlock(record),
    dimensions: buildDimensions(record),
    attributes: buildAttributes(record),
    updatedAt: toIsoString(
      getValue(record, ['updatedAt', 'modifiedAt', 'lastUpdatedAt', 'timestamp'])
    ),
    raw: record,
  };
}
