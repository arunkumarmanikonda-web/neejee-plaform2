export type KycVerificationProvider =
  | 'cashfree'
  | 'local_format'
  | 'manual_document_match'
  | 'mock'
  | 'unknown';

export type KycVerificationDocumentType = 'pan' | 'gst' | 'bank';

export type KycVerificationDecision =
  | 'verified'
  | 'review_required'
  | 'rejected'
  | 'pending';

export interface KycFieldMatchResult {
  field: string;
  providedValue: string | null;
  extractedValue: string | null;
  matched: boolean | null;
  reason: string | null;
}

export interface NormalizedKycVerificationResult {
  documentType: KycVerificationDocumentType;
  provider: KycVerificationProvider;
  status: string;
  decision: KycVerificationDecision;
  providedFields: Record<string, string | null>;
  extractedFields: Record<string, string | null>;
  matchResults: KycFieldMatchResult[];
  confidence: number | null;
  reviewRequired: boolean;
  mismatchReasons: string[];
  raw: unknown;
}

export interface NormalizeKycVerificationInput {
  documentType: KycVerificationDocumentType;
  provider?: string | null;
  status?: string | null;
  decision?: KycVerificationDecision | null;
  providedFields?: Record<string, unknown> | null;
  extractedFields?: Record<string, unknown> | null;
  matchResults?: Array<Partial<KycFieldMatchResult>> | null;
  confidence?: number | null;
  reviewRequired?: boolean | null;
  mismatchReasons?: string[] | null;
  raw?: unknown;
}

export function normalizeKycVerificationResult(
  input: NormalizeKycVerificationInput,
): NormalizedKycVerificationResult {
  return {
    documentType: input.documentType,
    provider: (input.provider ?? 'unknown') as KycVerificationProvider,
    status: input.status ?? 'pending',
    decision: input.decision ?? 'pending',
    providedFields: {},
    extractedFields: {},
    matchResults: [],
    confidence: input.confidence ?? null,
    reviewRequired: input.reviewRequired ?? false,
    mismatchReasons: input.mismatchReasons ?? [],
    raw: input.raw ?? null,
  };
}