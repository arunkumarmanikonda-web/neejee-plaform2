import { NextResponse } from 'next/server'
import { averageScore, buildVerificationPayload, toNullableString } from '@/lib/kyc/normalized-verification'

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

function parseBoolean(value: string | undefined, fallback = false) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function isMockMode() {
  return parseBoolean(process.env.KYC_MOCK_MODE, false)
}

function toNumberOrNull(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const pan = String(body?.pan ?? '').trim().toUpperCase()
    const name = String(body?.name ?? '').trim()

    if (!pan) {
      return NextResponse.json({
        ok: false,
        error: 'pan_required',
        ...buildVerificationPayload({
          verificationType: 'pan',
          provider: 'request_validation',
          ok: false,
          valid: false,
          status: 'INPUT_INVALID',
          reviewRequired: false,
          submitted: { pan, name: toNullableString(name) },
          extracted: {},
          fieldChecks: [],
          confidence: null,
          errorCode: 'pan_required',
        }),
      }, { status: 400 })
    }

    if (!PAN_RE.test(pan)) {
      return NextResponse.json({
        ok: false,
        valid: false,
        error: 'invalid_pan_format',
        pan,
        source: 'local_format',
      }, { status: 400 })
    }

    if (isMockMode()) {
      const resolvedName = name || 'TEST HOLDER'
      return NextResponse.json({
        ok: true,
        valid: true,
        pan,
        name: resolvedName,
        registeredName: resolvedName,
        providedName: name || null,
        nameMatchScore: name ? 100 : null,
        nameMatchResult: name ? 'DIRECT_MATCH' : null,
        panStatus: 'VALID',
        source: 'mock',
        ...buildVerificationPayload({
          verificationType: 'pan',
          provider: 'mock',
          ok: true,
          valid: true,
          status: 'VERIFIED',
          reviewRequired: false,
          submitted: { pan, name: toNullableString(name) },
          extracted: {
            pan,
            registeredName: resolvedName,
            panStatus: 'VALID',
          },
          fieldChecks: [
            {
              field: 'name',
              submittedValue: toNullableString(name),
              extractedValue: resolvedName,
              matched: name ? true : null,
              score: name ? 100 : null,
              reason: name ? 'DIRECT_MATCH' : null,
            },
          ],
          confidence: name ? 100 : null,
          referenceId: null,
        }),
      })
    }

    const provider = (process.env.PAN_KYC_PROVIDER || 'local_format').trim().toLowerCase()

    if (provider === 'cashfree') {
      const url = process.env.CASHFREE_PAN_VERIFY_URL
      const clientId = process.env.CASHFREE_VRS_CLIENT_ID
      const clientSecret = process.env.CASHFREE_VRS_CLIENT_SECRET
      const apiVersion = process.env.CASHFREE_VRS_API_VERSION

      if (!url || !clientId || !clientSecret) {
        return NextResponse.json({
          ok: false,
          error: 'cashfree_pan_not_configured',
          source: 'cashfree',
          ...buildVerificationPayload({
            verificationType: 'pan',
            provider: 'cashfree',
            ok: false,
            valid: false,
            status: 'PROVIDER_UNAVAILABLE',
            reviewRequired: true,
            submitted: { pan, name: toNullableString(name) },
            extracted: {},
            fieldChecks: [],
            confidence: null,
            errorCode: 'cashfree_pan_not_configured',
          }),
        }, { status: 503 })
      }

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
      }
      if (apiVersion) headers['x-api-version'] = apiVersion

      const upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pan,
          ...(name ? { name } : {}),
        }),
        cache: 'no-store',
      })

      const rawText = await upstream.text()
      let raw: any = null
      try { raw = rawText ? JSON.parse(rawText) : null } catch { raw = { rawText } }

      if (!upstream.ok) {
        return NextResponse.json({
          ok: false,
          error: 'cashfree_pan_upstream_error',
          source: 'cashfree',
          upstreamStatus: upstream.status,
          raw,
          ...buildVerificationPayload({
            verificationType: 'pan',
            provider: 'cashfree',
            ok: false,
            valid: false,
            status: 'UPSTREAM_ERROR',
            reviewRequired: true,
            submitted: { pan, name: toNullableString(name) },
            extracted: {},
            fieldChecks: [],
            confidence: null,
            errorCode: 'cashfree_pan_upstream_error',
            raw,
          }),
        }, { status: 502 })
      }

      const valid = Boolean(raw?.valid ?? (String(raw?.pan_status || '').toUpperCase() === 'VALID'))
      const registeredName = raw?.registered_name ?? raw?.name_pan_card ?? raw?.name_provided ?? null

      const nameMatchScore = toNumberOrNull(raw?.name_match_score)
      return NextResponse.json({
        ok: valid,
        valid,
        pan,
        name: registeredName,
        registeredName,
        providedName: raw?.name_provided ?? (name || null),
        type: raw?.type ?? null,
        fatherName: raw?.father_name ?? null,
        message: raw?.message ?? null,
        nameMatchScore,
        nameMatchResult: raw?.name_match_result ?? null,
        aadhaarSeedingStatus: raw?.aadhaar_seeding_status ?? null,
        aadhaarSeedingStatusDesc: raw?.aadhaar_seeding_status_desc ?? null,
        lastUpdatedAt: raw?.last_updated_at ?? null,
        panStatus: raw?.pan_status ?? null,
        referenceId: raw?.reference_id ?? null,
        source: 'cashfree',
        raw,
        ...buildVerificationPayload({
          verificationType: 'pan',
          provider: 'cashfree',
          ok: valid,
          valid,
          status: valid ? 'VERIFIED' : 'REJECTED',
          reviewRequired: !valid,
          submitted: { pan, name: toNullableString(name) },
          extracted: {
            pan,
            registeredName: toNullableString(registeredName),
            panStatus: toNullableString(raw?.pan_status),
            type: toNullableString(raw?.type),
            fatherName: toNullableString(raw?.father_name),
          },
          fieldChecks: [
            {
              field: 'name',
              submittedValue: toNullableString(name),
              extractedValue: toNullableString(registeredName),
              matched: raw?.name_match_result ? String(raw?.name_match_result).toUpperCase() === 'DIRECT_MATCH' : null,
              score: nameMatchScore,
              reason: toNullableString(raw?.name_match_result),
            },
          ],
          confidence: nameMatchScore,
          referenceId: toNullableString(raw?.reference_id),
          raw,
        }),
      }, { status: valid ? 200 : 422 })
    }

    return NextResponse.json({
      ok: true,
      valid: true,
      pan,
      name: name || null,
      registeredName: name || null,
      source: 'local_format',
      note: 'PAN format validated locally; live provider disabled.',
      ...buildVerificationPayload({
        verificationType: 'pan',
        provider: 'local_format',
        ok: true,
        valid: true,
        status: 'FORMAT_VALIDATED',
        reviewRequired: true,
        submitted: { pan, name: toNullableString(name) },
        extracted: {
          pan,
          registeredName: toNullableString(name),
        },
        fieldChecks: [
          {
            field: 'name',
            submittedValue: toNullableString(name),
            extractedValue: toNullableString(name),
            matched: name ? true : null,
            score: name ? 100 : null,
            reason: name ? 'SELF_DECLARED' : null,
          },
        ],
        confidence: name ? 100 : null,
        referenceId: null,
      }),
    })
  } catch (error) {
    console.error('PAN verify error', error)
    return NextResponse.json({
      ok: false,
      error: 'pan_verify_failed',
      ...buildVerificationPayload({
        verificationType: 'pan',
        provider: 'internal',
        ok: false,
        valid: false,
        status: 'INTERNAL_ERROR',
        reviewRequired: true,
        submitted: {},
        extracted: {},
        fieldChecks: [],
        confidence: null,
        errorCode: 'pan_verify_failed',
      }),
    }, { status: 500 })
  }
}