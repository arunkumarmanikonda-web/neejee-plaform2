import type { ProductReadPricing } from './contracts';

export type PricingReadSourceRow = {
  mrp?: number | null;
  sellingPrice?: number | null;
  salePrice?: number | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  gstRate?: number | null;
  hsnCode?: string | null;
};

export function parseMoney(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseNullableDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isSaleLive(
  product: PricingReadSourceRow,
  now = new Date()
): boolean {
  const salePrice = parseMoney(product.salePrice);
  const sellingPrice = parseMoney(product.sellingPrice);

  if (!Number.isFinite(salePrice) || salePrice <= 0) return false;
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return false;
  if (salePrice >= sellingPrice) return false;

  const startsAt = parseNullableDate(product.saleStartsAt);
  const endsAt = parseNullableDate(product.saleEndsAt);

  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;

  return true;
}

export function buildPricing(
  product: PricingReadSourceRow,
  now = new Date()
): ProductReadPricing {
  const mrp = parseMoney(product.mrp);
  const sellingPrice = parseMoney(product.sellingPrice);
  const liveSale = isSaleLive(product, now);
  const parsedSalePrice = parseMoney(product.salePrice);

  const salePrice = liveSale && parsedSalePrice > 0 ? parsedSalePrice : null;
  const effectivePrice = salePrice && salePrice > 0 ? salePrice : sellingPrice;

  const discountAmount =
    mrp > 0 && effectivePrice > 0 && mrp > effectivePrice
      ? mrp - effectivePrice
      : 0;

  const discountPercent =
    mrp > 0 && discountAmount > 0
      ? Math.round((discountAmount / mrp) * 100)
      : 0;

  return {
    mrp,
    sellingPrice,
    salePrice,
    effectivePrice,
    displayPrice: effectivePrice,
    onSale: liveSale,
    discountAmount,
    discountPercent,
    saleWindow: {
      startsAt: parseNullableDate(product.saleStartsAt),
      endsAt: parseNullableDate(product.saleEndsAt),
    },
    gstRate:
      typeof product.gstRate === 'number'
        ? product.gstRate
        : product.gstRate == null
        ? null
        : Number(product.gstRate),
    hsnCode:
      product.hsnCode === undefined || product.hsnCode === null
        ? null
        : String(product.hsnCode).trim() || null,
    currency: 'INR',
  };
}
