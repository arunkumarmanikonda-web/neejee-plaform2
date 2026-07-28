export type KycVerificationProvider =
  | 'ai-core'
  | 'ocr'
  | 'external'
  | 'admin-manual'
  | 'seller-self';

export type KycVerificationDocumentType = 'pan' | 'gst' | 'bank';

export type KycVerificationDecision = 'approved' | 'review' | 'rejected';

export type KycFieldMatchResult = {
  field: string;
  typedValue: string;
  extractedValue: string;
  normalizedTypedValue: string;
  normalizedExtractedValue: string;
  matched: boolean;
  confidence: number;
  notes?: string;
};

export type NormalizeKycVerificationInput = {
  provider: KycVerificationProvider;
  documentType: KycVerificationDocumentType;
  decision: KycVerificationDecision;
  confidence: number;
  typed: Record<string, unknown>;
  extracted: Record<string, unknown>;
  fieldResults: KycFieldMatchResult[];
  exceptionReasons?: string[];
  requiresManualReview?: boolean;
  metadata?: Record<string, unknown>;
  notes?: string;
};

export type NormalizedKycVerificationResult = {
  provider: KycVerificationProvider;
  documentType: KycVerificationDocumentType;
  decision: KycVerificationDecision;
  confidence: number;
  typed: Record<string, unknown>;
  extracted: Record<string, unknown>;
  fieldResults: KycFieldMatchResult[];
  exceptionReasons: string[];
  requiresManualReview: boolean;
  metadata: Record<string, unknown>;
  notes: string;
  timestamp: string;
};

export function normalizeKycVerificationResult(
  input: NormalizeKycVerificationInput,
): NormalizedKycVerificationResult {
  const confidence = Number.isFinite(input.confidence)
    ? Math.max(0, Math.min(0.99, Number(input.confidence.toFixed(2))))
    : 0;

  return {
    provider: input.provider,
    documentType: input.documentType,
    decision: input.decision,
    confidence,
    typed: input.typed ?? {},
    extracted: input.extracted ?? {},
    fieldResults: Array.isArray(input.fieldResults) ? input.fieldResults : [],
    exceptionReasons: Array.isArray(input.exceptionReasons) ? input.exceptionReasons : [],
    requiresManualReview: Boolean(input.requiresManualReview),
    metadata: input.metadata ?? {},
    notes: input.notes ?? '',
    timestamp: new Date().toISOString(),
  };
}