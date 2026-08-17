import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasKycVerificationAccess } from '@/lib/kyc/request-access'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  name: z.string().optional().nullable(),
  businessName: z.string().optional().nullable(),
  pan: z.string().min(10),
  gstin: z.string().optional().nullable(),
  bankAccount: z.string().min(6),
  ifsc: z.string().min(5),
  phone: z.string().optional().nullable(),
})

type FieldCheck = {
  field: string
  submittedValue: string | null
  extractedValue: string | null
  matched: boolean | null
  score: number | null
  reason: string | null
}

type VerificationEnvelope = {
  ok?: boolean
  error?: string
  verification?: {
    verificationType?: 'pan' | 'gst' | 'bank'
    provider?: string
    ok?: boolean
    valid?: boolean | null
    status?: string
    reviewRequired?: boolean
    submitted?: Record<string, unknown>
    extracted?: Record<string, unknown>
    fieldChecks?: FieldCheck[]
    confidence?: number | null
    referenceId?: string | null
    errorCode?: string | null
    raw?: unknown
  }
} & Record<string, unknown>

function toNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

async function postJson(request: NextRequest, pathname: string, body: Record<string, unknown>) {
  const url = new URL(pathname, request.url)
  const cookie = request.headers.get('cookie')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  let payload: VerificationEnvelope = {}
  try {
    payload = (await response.json()) as VerificationEnvelope
  } catch {
    payload = { ok: false, error: 'invalid_json_response' }
  }

  return { httpStatus: response.status, payload }
}

function normalizeResult(
  label: 'pan' | 'gst' | 'bank',
  response: { httpStatus: number; payload: VerificationEnvelope }
) {
  const verification = response.payload.verification ?? {}

  return {
    kind: label,
    httpStatus: response.httpStatus,
    ok: Boolean(response.payload.ok ?? verification.ok),
    error: response.payload.error ?? verification.errorCode ?? null,
    verification: {
      verificationType: verification.verificationType ?? label,
      provider: verification.provider ?? 'unknown',
      ok: Boolean(verification.ok ?? response.payload.ok),
      valid: verification.valid ?? null,
      status: verification.status ?? 'UNKNOWN',
      reviewRequired: Boolean(verification.reviewRequired),
      submitted: verification.submitted ?? {},
      extracted: verification.extracted ?? {},
      fieldChecks: verification.fieldChecks ?? [],
      confidence: verification.confidence ?? null,
      referenceId: verification.referenceId ?? null,
      errorCode: verification.errorCode ?? response.payload.error ?? null,
    },
  }
}

function summarize(results: Array<ReturnType<typeof normalizeResult>>) {
  const totalChecks = results.length
  const okCount = results.filter((item) => item.ok).length
  const failedCount = results.filter((item) => !item.ok).length
  const reviewRequiredCount = results.filter((item) => item.verification.reviewRequired).length

  return {
    totalChecks,
    okCount,
    failedCount,
    reviewRequiredCount,
    statuses: results.map((item) => ({
      kind: item.kind,
      status: item.verification.status,
      provider: item.verification.provider,
      ok: item.ok,
      reviewRequired: item.verification.reviewRequired,
    })),
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json())
    if (!(await hasKycVerificationAccess(body.phone || undefined))) {
      return NextResponse.json({ ok: false, error: 'kyc_verification_unauthorized' }, { status: 401 })
    }

    const resolvedName = String(body.name ?? body.businessName ?? '').trim() || null

    const panResponse = await postJson(request, '/api/kyc/verify/pan', {
      pan: body.pan,
      name: resolvedName,
    })

    const bankResponse = await postJson(request, '/api/kyc/verify/bank', {
      bankAccount: body.bankAccount,
      ifsc: body.ifsc,
      name: resolvedName,
      phone: body.phone ?? null,
    })

    const results = [
      normalizeResult('pan', panResponse),
      normalizeResult('bank', bankResponse),
    ]

    let gstResult: ReturnType<typeof normalizeResult> | null = null
    if (body.gstin) {
      const gstResponse = await postJson(request, '/api/kyc/verify/gst', {
        gstin: body.gstin,
        pan: body.pan,
      })
      gstResult = normalizeResult('gst', gstResponse)
      results.push(gstResult)
    }

    const overallOk = results.every((item) => item.ok)
    const reviewRequired = results.some(
      (item) => item.verification.reviewRequired || !item.ok
    )

    const overallStatus = reviewRequired
      ? 'REVIEW_REQUIRED'
      : overallOk
        ? 'VERIFIED'
        : 'FAILED'

    return NextResponse.json({
      ok: overallOk,
      overallStatus,
      reviewRequired,
      submitted: {
        name: toNullableString(resolvedName),
        businessName: toNullableString(body.businessName),
        pan: toNullableString(body.pan),
        gstin: toNullableString(body.gstin),
        bankAccountLast4: body.bankAccount.slice(-4),
        ifsc: toNullableString(body.ifsc),
        phone: toNullableString(body.phone),
      },
      verifications: {
        pan: results.find((item) => item.kind === 'pan') ?? null,
        gst: gstResult,
        bank: results.find((item) => item.kind === 'bank') ?? null,
      },
      summary: summarize(results),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'invalid_package_request', issues: error.issues },
        { status: 400 }
      )
    }

    console.error('[kyc.verify.package] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    })
    return NextResponse.json(
      { ok: false, error: 'kyc_package_verify_failed' },
      { status: 500 }
    )
  }
}
