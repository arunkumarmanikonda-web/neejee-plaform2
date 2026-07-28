import { NextRequest, NextResponse } from 'next/server';
import {
  normalizeKycVerificationResult,
  type KycVerificationDecision,
  type KycVerificationDocumentType,
  type NormalizedKycVerificationResult,
} from '../../../admin/seller-onboarding/kyc-contract';

type SellerKycStatusResponse = {
  documents: Record<KycVerificationDocumentType, NormalizedKycVerificationResult>;
  overallDecision: KycVerificationDecision;
  overallReviewRequired: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asDecision(value: unknown): KycVerificationDecision | null {
  if (value === 'verified') return 'verified';
  if (value === 'review_required') return 'review_required';
  if (value === 'rejected') return 'rejected';
  if (value === 'pending') return 'pending';
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
}

function buildDocument(
  documentType: KycVerificationDocumentType,
  value: unknown,
): NormalizedKycVerificationResult {
  const source = asRecord(value) ?? {};

  return normalizeKycVerificationResult({
    documentType,
    provider: typeof source.provider === 'string' ? source.provider : null,
    status: typeof source.status === 'string' ? source.status : null,
    decision: asDecision(source.decision),
    providedFields: asRecord(source.providedFields),
    extractedFields: asRecord(source.extractedFields),
    confidence: typeof source.confidence === 'number' ? source.confidence : null,
    reviewRequired:
      typeof source.reviewRequired === 'boolean' ? source.reviewRequired : null,
    mismatchReasons: asStringArray(source.mismatchReasons),
    raw: Object.prototype.hasOwnProperty.call(source, 'raw') ? source.raw : source,
  });
}

function computeOverallDecision(
  pan: NormalizedKycVerificationResult,
  gst: NormalizedKycVerificationResult,
  bank: NormalizedKycVerificationResult,
): KycVerificationDecision {
  const docs = [pan, gst, bank];

  if (docs.some((doc) => doc.decision === 'rejected')) return 'rejected';
  if (docs.some((doc) => doc.reviewRequired || doc.decision === 'review_required')) {
    return 'review_required';
  }
  if (docs.every((doc) => doc.decision === 'verified')) return 'verified';
  return 'pending';
}

function buildResponse(
  pan: NormalizedKycVerificationResult,
  gst: NormalizedKycVerificationResult,
  bank: NormalizedKycVerificationResult,
): SellerKycStatusResponse {
  return {
    documents: {
      pan,
      gst,
      bank,
    },
    overallDecision: computeOverallDecision(pan, gst, bank),
    overallReviewRequired:
      pan.reviewRequired || gst.reviewRequired || bank.reviewRequired,
  };
}

export async function GET() {
  const pan = buildDocument('pan', null);
  const gst = buildDocument('gst', null);
  const bank = buildDocument('bank', null);

  return NextResponse.json(buildResponse(pan, gst, bank));
}

export async function POST(request: NextRequest) {
  const bodyUnknown = await request.json().catch(() => ({}));
  const body = asRecord(bodyUnknown) ?? {};

  const pan = buildDocument('pan', body.pan);
  const gst = buildDocument('gst', body.gst);
  const bank = buildDocument('bank', body.bank);

  return NextResponse.json(buildResponse(pan, gst, bank));
}