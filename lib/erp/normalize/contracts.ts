import type { ErpCurrencyCode, ErpProductStatus } from '../adapter';

export const ERP_NORMALIZE_VERSION = 'phase3.erp-normalize.v1' as const;

export type ErpRawRecord = Record<string, unknown>;
export type ErpMoneySourceUnit = 'paise' | 'rupees' | 'major';

export interface ErpNormalizedPriceBlock {
  currency: ErpCurrencyCode;
  mrpPaise: number;
  sellingPricePaise: number;
  effectivePricePaise: number;
  onSale: boolean;
}

export interface ErpNormalizedDimensions {
  weightGrams: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
}

export interface ErpNormalizedProductPayload {
  version: typeof ERP_NORMALIZE_VERSION;
  externalId: string | null;
  sku: string;
  slug: string;
  name: string;
  sellerCode: string | null;
  status: ErpProductStatus;
  categoryCode: string | null;
  price: ErpNormalizedPriceBlock;
  dimensions: ErpNormalizedDimensions;
  attributes: Record<string, string>;
  updatedAt: string;
  raw: ErpRawRecord;
}

export interface ErpNormalizedInventoryPayload {
  version: typeof ERP_NORMALIZE_VERSION;
  externalId: string | null;
  sku: string;
  availableQuantity: number;
  reservedQuantity: number;
  incomingQuantity: number;
  lowStockThreshold: number | null;
  inStock: boolean;
  updatedAt: string;
  raw: ErpRawRecord;
}

export interface ErpNormalizationBundle {
  product: ErpNormalizedProductPayload;
  inventory: ErpNormalizedInventoryPayload;
}
