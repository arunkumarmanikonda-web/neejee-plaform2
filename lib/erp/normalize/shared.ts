import type { ErpCurrencyCode, ErpProductStatus } from '../adapter';
import type { ErpMoneySourceUnit, ErpRawRecord } from './contracts';

const DEFAULT_TIMESTAMP = '2026-07-10T00:00:00.000Z';

export function asRecord(value: unknown): ErpRawRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as ErpRawRecord;
  }

  return {};
}

export function getValue(
  record: ErpRawRecord,
  keys: readonly string[]
): unknown {
  for (const key of keys) {
    if (!(key in record)) {
      continue;
    }

    const value = record[key];

    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      continue;
    }

    return value;
  }

  return undefined;
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (
      ['true', '1', 'yes', 'y', 'active', 'enabled', 'available', 'in_stock'].includes(
        normalized
      )
    ) {
      return true;
    }

    if (
      ['false', '0', 'no', 'n', 'inactive', 'disabled', 'out_of_stock', 'oos'].includes(
        normalized
      )
    ) {
      return false;
    }
  }

  return null;
}

export function toIsoString(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return DEFAULT_TIMESTAMP;
}

export function normalizeSku(value: unknown): string {
  const raw = asTrimmedString(value) ?? '';

  return raw
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-');
}

export function slugify(value: unknown, fallback = 'item'): string {
  const raw = asTrimmedString(value) ?? fallback;

  return raw
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function normalizeCurrencyCode(
  value: unknown,
  fallback: ErpCurrencyCode = 'INR'
): ErpCurrencyCode {
  const normalized = asTrimmedString(value)?.toUpperCase();

  if (!normalized) {
    return fallback;
  }

  if (['RS', 'INR', '₹'].includes(normalized)) {
    return 'INR';
  }

  if (['USD', '$'].includes(normalized)) {
    return 'USD';
  }

  if (['EUR', '€'].includes(normalized)) {
    return 'EUR';
  }

  return normalized;
}

export function normalizeProductStatus(value: unknown): ErpProductStatus {
  if (typeof value === 'boolean') {
    return value ? 'ACTIVE' : 'INACTIVE';
  }

  if (typeof value === 'number') {
    return value === 1 ? 'ACTIVE' : 'INACTIVE';
  }

  const normalized = asTrimmedString(value)?.toLowerCase();

  if (!normalized) {
    return 'DRAFT';
  }

  if (
    ['active', 'enabled', 'live', 'published', 'approved', '1', 'yes'].includes(
      normalized
    )
  ) {
    return 'ACTIVE';
  }

  if (['draft', 'pending', 'pending_qc', 'staged'].includes(normalized)) {
    return 'DRAFT';
  }

  return 'INACTIVE';
}

export function normalizeQuantity(value: unknown): number {
  const parsed = asNumber(value);

  if (parsed === null) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
}

export function normalizeMoneyToPaise(
  value: unknown,
  sourceUnit: ErpMoneySourceUnit
): { amountPaise: number; sourceUnit: ErpMoneySourceUnit } {
  const parsed = asNumber(value);

  if (parsed === null) {
    return {
      amountPaise: 0,
      sourceUnit,
    };
  }

  if (sourceUnit === 'paise') {
    return {
      amountPaise: Math.max(0, Math.round(parsed)),
      sourceUnit,
    };
  }

  return {
    amountPaise: Math.max(0, Math.round(parsed * 100)),
    sourceUnit,
  };
}

export function normalizeWeightGrams(
  value: unknown,
  unitHint?: unknown
): number | null {
  const parsed = asNumber(value);

  if (parsed === null) {
    return null;
  }

  const unit = asTrimmedString(unitHint)?.toLowerCase();

  if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') {
    return Math.round(parsed * 1000);
  }

  return Math.round(parsed);
}

export function normalizeDimensionMm(
  value: unknown,
  unitHint?: unknown
): number | null {
  const parsed = asNumber(value);

  if (parsed === null) {
    return null;
  }

  const unit = asTrimmedString(unitHint)?.toLowerCase();

  if (unit === 'cm' || unit === 'centimeter' || unit === 'centimeters') {
    return Math.round(parsed * 10);
  }

  if (unit === 'm' || unit === 'meter' || unit === 'meters') {
    return Math.round(parsed * 1000);
  }

  return Math.round(parsed);
}
