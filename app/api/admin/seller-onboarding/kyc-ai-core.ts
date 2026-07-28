import {
  KycFieldMatchResult,
  KycVerificationDecision,
  KycVerificationDocumentType,
  KycVerificationProvider,
  NormalizedKycVerificationResult,
  normalizeKycVerificationResult,
} from './kyc-contract';

export type KycActor = 'admin' | 'seller';

export type KycDocumentInput = {
  actor: KycActor;
  documentType: KycVerificationDocumentType;
  provider?: string;
  typed?: Record<string, unknown>;
  extracted?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type AggregatedKycStatus = {
  actor: KycActor;
  overallDecision: KycVerificationDecision;
  confidenceAverage: number;
  completedDocuments: number;
  approvedDocuments: number;
  reviewDocuments: number;
  rejectedDocuments: number;
  missingDocuments: KycVerificationDocumentType[];
  exceptionReasons: string[];
  documents: Partial<Record<KycVerificationDocumentType, NormalizedKycVerificationResult>>;
  nextAction: 'approved' | 'manual-review' | 'complete-missing-documents';
};

const DOCUMENT_FIELDS: Record<KycVerificationDocumentType, string[]> = {
  pan: ['panNumber', 'fullName'],
  gst: ['gstin', 'legalName'],
  bank: ['accountNumber', 'ifsc', 'accountHolderName'],
};

function toCleanString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function normalizeFieldValue(field: string, value: unknown): string {
  const raw = toCleanString(value);
  if (!raw) {
    return '';
  }

  switch (field) {
    case 'panNumber':
      return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    case 'gstin':
      return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    case 'ifsc':
      return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    case 'accountNumber':
      return raw.replace(/\D/g, '');
    case 'fullName':
    case 'legalName':
    case 'accountHolderName':
      return raw.toUpperCase().replace(/\s+/g, ' ').trim();
    default:
      return raw.toUpperCase().replace(/\s+/g, ' ').trim();
  }
}

function pickProvider(actor: KycActor, provider?: string): KycVerificationProvider {
  const normalized = toCleanString(provider).toLowerCase();
  if (
    normalized === 'ai-core' ||
    normalized === 'ocr' ||
    normalized === 'external' ||
    normalized === 'admin-manual' ||
    normalized === 'seller-self'
  ) {
    return normalized as KycVerificationProvider;
  }

  return actor === 'admin' ? 'admin-manual' : 'seller-self';
}

function validateDocumentFormats(
  documentType: KycVerificationDocumentType,
  typed: Record<string, unknown>,
  extracted: Record<string, unknown>,
): string[] {
  const typedPan = normalizeFieldValue('panNumber', typed.panNumber);
  const extractedPan = normalizeFieldValue('panNumber', extracted.panNumber);
  const typedGstin = normalizeFieldValue('gstin', typed.gstin);
  const extractedGstin = normalizeFieldValue('gstin', extracted.gstin);
  const typedIfsc = normalizeFieldValue('ifsc', typed.ifsc);
  const extractedIfsc = normalizeFieldValue('ifsc', extracted.ifsc);
  const typedAccount = normalizeFieldValue('accountNumber', typed.accountNumber);
  const extractedAccount = normalizeFieldValue('accountNumber', extracted.accountNumber);

  const reasons: string[] = [];

  if (documentType === 'pan') {
    const value = typedPan || extractedPan;
    if (value && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value)) {
      reasons.push('INVALID_PAN_FORMAT');
    }
  }

  if (documentType === 'gst') {
    const value = typedGstin || extractedGstin;
    if (value && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value)) {
      reasons.push('INVALID_GSTIN_FORMAT');
    }
  }

  if (documentType === 'bank') {
    if ((typedIfsc || extractedIfsc) && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(typedIfsc || extractedIfsc))) {
      reasons.push('INVALID_IFSC_FORMAT');
    }
    if ((typedAccount || extractedAccount) && !/^[0-9]{6,18}$/.test(String(typedAccount || extractedAccount))) {
      reasons.push('INVALID_ACCOUNT_NUMBER_FORMAT');
    }
  }

  return reasons;
}

function buildFieldResults(
  documentType: KycVerificationDocumentType,
  typed: Record<string, unknown>,
  extracted: Record<string, unknown>,
): KycFieldMatchResult[] {
  return DOCUMENT_FIELDS[documentType].map((field) => {
    const typedValue = toCleanString(typed[field]);
    const extractedValue = toCleanString(extracted[field]);
    const normalizedTypedValue = normalizeFieldValue(field, typed[field]);
    const normalizedExtractedValue = normalizeFieldValue(field, extracted[field]);

    const hasTyped = normalizedTypedValue.length > 0;
    const hasExtracted = normalizedExtractedValue.length > 0;
    const matched = hasTyped && hasExtracted && normalizedTypedValue === normalizedExtractedValue;

    let confidence = 0;
    let notes = '';

    if (matched) {
      confidence = 0.98;
      notes = 'typed-and-extracted-match';
    } else if (hasTyped && !hasExtracted) {
      confidence = 0.45;
      notes = 'missing-extracted-value';
    } else if (!hasTyped && hasExtracted) {
      confidence = 0.45;
      notes = 'missing-typed-value';
    } else if (hasTyped && hasExtracted) {
      confidence = 0.15;
      notes = 'typed-and-extracted-mismatch';
    } else {
      confidence = 0.05;
      notes = 'missing-both-values';
    }

    return {
      field,
      typedValue,
      extractedValue,
      normalizedTypedValue,
      normalizedExtractedValue,
      matched,
      confidence,
      notes,
    };
  });
}

function decideVerificationResult(
  fieldResults: KycFieldMatchResult[],
  formatReasons: string[],
): { decision: KycVerificationDecision; requiresManualReview: boolean; exceptionReasons: string[]; confidence: number } {
  const total = fieldResults.length || 1;
  const matchedCount = fieldResults.filter((item) => item.matched).length;
  const missingTyped = fieldResults.filter((item) => item.notes === 'missing-typed-value').length;
  const missingExtracted = fieldResults.filter((item) => item.notes === 'missing-extracted-value').length;
  const mismatchCount = fieldResults.filter((item) => item.notes === 'typed-and-extracted-mismatch').length;
  const missingBoth = fieldResults.filter((item) => item.notes === 'missing-both-values').length;

  const matchRatio = matchedCount / total;
  let confidence = 0.25 + matchRatio * 0.55;
  confidence -= mismatchCount * 0.12;
  confidence -= missingBoth * 0.10;
  confidence -= formatReasons.length * 0.20;
  confidence += missingTyped > 0 ? 0 : 0.05;
  confidence += missingExtracted > 0 ? 0 : 0.05;
  confidence = Math.max(0.01, Math.min(0.99, Number(confidence.toFixed(2))));

  const exceptionReasons = new Set<string>();
  formatReasons.forEach((reason) => exceptionReasons.add(reason));

  if (mismatchCount > 0) {
    exceptionReasons.add('FIELD_MISMATCH');
  }
  if (missingTyped > 0) {
    exceptionReasons.add('MISSING_TYPED_DATA');
  }
  if (missingExtracted > 0) {
    exceptionReasons.add('MISSING_EXTRACTED_DATA');
  }
  if (missingBoth > 0) {
    exceptionReasons.add('MISSING_REQUIRED_FIELDS');
  }
  if (confidence < 0.6) {
    exceptionReasons.add('LOW_CONFIDENCE');
  }

  let decision: KycVerificationDecision = 'review';

  if (formatReasons.length > 0 || (mismatchCount >= Math.ceil(total / 2) && confidence < 0.5)) {
    decision = 'rejected';
  } else if (matchRatio >= 0.8 && confidence >= 0.8 && exceptionReasons.size === 0) {
    decision = 'approved';
  } else {
    decision = 'review';
  }

  const requiresManualReview = decision !== 'approved';
  if (requiresManualReview) {
    exceptionReasons.add('MANUAL_REVIEW_REQUIRED');
  }

  return {
    decision,
    requiresManualReview,
    exceptionReasons: Array.from(exceptionReasons),
    confidence,
  };
}

export function verifyKycDocument(input: KycDocumentInput): NormalizedKycVerificationResult {
  const typed = input.typed ?? {};
  const extracted = input.extracted ?? {};
  const metadata = input.metadata ?? {};
  const fieldResults = buildFieldResults(input.documentType, typed, extracted);
  const formatReasons = validateDocumentFormats(input.documentType, typed, extracted);
  const decisionState = decideVerificationResult(fieldResults, formatReasons);
  const provider = pickProvider(input.actor, input.provider);

  const matchedCount = fieldResults.filter((item) => item.matched).length;
  const summary =
    'actor=' +
    input.actor +
    '; matches=' +
    matchedCount +
    '/' +
    fieldResults.length +
    '; decision=' +
    decisionState.decision +
    '; confidence=' +
    decisionState.confidence.toFixed(2);

  return normalizeKycVerificationResult({
    provider,
    documentType: input.documentType,
    decision: decisionState.decision,
    confidence: decisionState.confidence,
    typed,
    extracted,
    fieldResults,
    exceptionReasons: decisionState.exceptionReasons,
    requiresManualReview: decisionState.requiresManualReview,
    metadata: {
      actor: input.actor,
      ...metadata,
    },
    notes: summary,
  });
}

export function aggregateKycStatus(
  actor: KycActor,
  documents: Partial<Record<KycVerificationDocumentType, NormalizedKycVerificationResult>>,
): AggregatedKycStatus {
  const presentTypes = (Object.keys(documents) as KycVerificationDocumentType[]).filter(
    (key) => documents[key],
  );

  const presentDocs = presentTypes
    .map((key) => documents[key])
    .filter((value): value is NormalizedKycVerificationResult => Boolean(value));

  const approvedDocuments = presentDocs.filter((item) => item.decision === 'approved').length;
  const reviewDocuments = presentDocs.filter((item) => item.decision === 'review').length;
  const rejectedDocuments = presentDocs.filter((item) => item.decision === 'rejected').length;
  const missingDocuments = (['pan', 'gst', 'bank'] as KycVerificationDocumentType[]).filter(
    (key) => !documents[key],
  );

  const confidenceAverage =
    presentDocs.length > 0
      ? Number((presentDocs.reduce((sum, item) => sum + item.confidence, 0) / presentDocs.length).toFixed(2))
      : 0;

  const exceptionReasons = Array.from(new Set(presentDocs.flatMap((item) => item.exceptionReasons ?? [])));

  let overallDecision: KycVerificationDecision = 'review';
  let nextAction: AggregatedKycStatus['nextAction'] = 'manual-review';

  if (missingDocuments.length > 0) {
    overallDecision = 'review';
    nextAction = 'complete-missing-documents';
  } else if (rejectedDocuments > 0) {
    overallDecision = 'rejected';
    nextAction = 'manual-review';
  } else if (reviewDocuments > 0) {
    overallDecision = 'review';
    nextAction = 'manual-review';
  } else if (approvedDocuments === 3) {
    overallDecision = 'approved';
    nextAction = 'approved';
  }

  return {
    actor,
    overallDecision,
    confidenceAverage,
    completedDocuments: presentDocs.length,
    approvedDocuments,
    reviewDocuments,
    rejectedDocuments,
    missingDocuments,
    exceptionReasons,
    documents,
    nextAction,
  };
}