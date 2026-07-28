type FieldCheck = {
  field: string
  submittedValue: string | null
  extractedValue: string | null
  matched: boolean | null
  score: number | null
  reason: string | null
}

type BuildVerificationInput = {
  verificationType: 'pan' | 'gst' | 'bank'
  provider: string
  ok: boolean
  valid: boolean | null
  reviewRequired?: boolean
  status: string
  submitted?: Record<string, unknown>
  extracted?: Record<string, unknown>
  fieldChecks?: FieldCheck[]
  confidence?: number | null
  referenceId?: string | null
  errorCode?: string | null
  raw?: unknown
}

export function toNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

export function averageScore(scores: Array<number | null | undefined>) {
  const validScores = scores.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!validScores.length) return null
  return Math.round(validScores.reduce((sum, value) => sum + value, 0) / validScores.length)
}

export function buildVerificationPayload(input: BuildVerificationInput) {
  return {
    verification: {
      verificationType: input.verificationType,
      provider: input.provider,
      ok: input.ok,
      valid: input.valid,
      status: input.status,
      reviewRequired: Boolean(input.reviewRequired),
      submitted: input.submitted ?? {},
      extracted: input.extracted ?? {},
      fieldChecks: input.fieldChecks ?? [],
      confidence: input.confidence ?? null,
      referenceId: input.referenceId ?? null,
      errorCode: input.errorCode ?? null,
      raw: input.raw ?? null,
    },
  }
}
