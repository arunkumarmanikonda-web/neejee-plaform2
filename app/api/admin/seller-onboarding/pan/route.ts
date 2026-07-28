import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeKycVerificationResult,
  type KycVerificationDecision,
} from '../kyc-contract';

function normalizeDecision(value: unknown): KycVerificationDecision | null {
  if (value === 'verified') return 'verified';
  if (value === 'review_required') return 'review_required';
  if (value === 'rejected') return 'rejected';
  if (value === 'pending') return 'pending';
  return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));

  const providedFields =
    toRecord(body?.providedFields) ??
    {
      panNumber: typeof body?.panNumber === 'string' ? body.panNumber : null,
      fullName: typeof body?.fullName === 'string' ? body.fullName : null,
      dateOfBirth: typeof body?.dateOfBirth === 'string' ? body.dateOfBirth : null,
      legalName: typeof body?.legalName === 'string' ? body.legalName : null,
    };

  const extractedFields = toRecord(body?.extractedFields) ?? {};
  const matchResults = Array.isArray(body?.matchResults) ? body.matchResults : [];
  const mismatchReasons = toStringArray(body?.mismatchReasons);

  const normalized = normalizeKycVerificationResult({
    documentType: 'pan',
    provider: typeof body?.provider === 'string' ? body.provider : null,
    status: typeof body?.status === 'string' ? body.status : null,
    decision: normalizeDecision(body?.decision),
    providedFields,
    extractedFields,
    matchResults,
    confidence: typeof body?.confidence === 'number' ? body.confidence : null,
    reviewRequired:
      typeof body?.reviewRequired === 'boolean'
        ? body.reviewRequired
        : mismatchReasons.length > 0,
    mismatchReasons,
    raw: Object.prototype.hasOwnProperty.call(body, 'raw') ? body.raw : body,
  });

  return NextResponse.json(normalized);
}