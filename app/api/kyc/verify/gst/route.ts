import { NextResponse } from 'next/server'
import { buildVerificationPayload, toNullableString } from '@/lib/kyc/normalized-verification'

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

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

function gstPan(gstin: string) {
  return gstin.slice(2, 12)
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const gstin = String(body?.gstin ?? body?.GSTIN ?? '').trim().toUpperCase()
    const inputPan = String(body?.pan ?? '').trim().toUpperCase()

    if (!gstin) {
      return NextResponse.json({
        ok: false,
        error: 'gstin_required',
        ...buildVerificationPayload({
          verificationType: 'gst',
          provider: 'request_validation',
          ok: false,
          valid: false,
          status: 'INPUT_INVALID',
          reviewRequired: false,
          submitted: { gstin, pan: toNullableString(inputPan) },
          extracted: {},
          fieldChecks: [],
          confidence: null,
          errorCode: 'gstin_required',
        }),
      }, { status: 400 })
    }

    if (!GSTIN_RE.test(gstin)) {
      return NextResponse.json(
        {
          ok: false,
          valid: false,
          error: 'invalid_gstin_format',
          gstin,
          source: 'local_format',
          ...buildVerificationPayload({
            verificationType: 'gst',
            provider: 'local_format',
            ok: false,
            valid: false,
            status: 'INPUT_INVALID',
            reviewRequired: false,
            submitted: { gstin, pan: toNullableString(inputPan) },
            extracted: { gstin },
            fieldChecks: [
              {
                field: 'gstin',
                submittedValue: gstin,
                extractedValue: gstin,
                matched: false,
                score: null,
                reason: 'invalid_gstin_format',
              },
            ],
            confidence: null,
            errorCode: 'invalid_gstin_format',
          }),
        },
        { status: 400 }
      )
    }

    const embeddedPan = gstPan(gstin)
    const panMatches = inputPan ? embeddedPan === inputPan : null

    if (isMockMode()) {
      return NextResponse.json({
        ok: true,
        valid: true,
        gstin,
        legalName: 'TEST BUSINESS',
        tradeName: 'TEST BUSINESS',
        name: 'TEST BUSINESS',
        pan: embeddedPan,
        panMatches,
        gstStatus: 'Active',
        source: 'mock',
        ...buildVerificationPayload({
          verificationType: 'gst',
          provider: 'mock',
          ok: true,
          valid: true,
          status: 'VERIFIED',
          reviewRequired: false,
          submitted: { gstin, pan: toNullableString(inputPan) },
          extracted: {
            gstin,
            pan: embeddedPan,
            legalName: 'TEST BUSINESS',
            tradeName: 'TEST BUSINESS',
            gstStatus: 'Active',
          },
          fieldChecks: [
            {
              field: 'pan',
              submittedValue: toNullableString(inputPan),
              extractedValue: embeddedPan,
              matched: panMatches,
              score: panMatches === true ? 100 : panMatches === false ? 0 : null,
              reason: panMatches === true ? 'GST_PAN_MATCH' : panMatches === false ? 'GST_PAN_MISMATCH' : null,
            },
          ],
          confidence: panMatches === true ? 100 : null,
          referenceId: null,
        }),
      })
    }

    const provider = (process.env.GST_KYC_PROVIDER || 'local_format').trim().toLowerCase()

    if (provider === 'cashfree') {
      const url = process.env.CASHFREE_GST_VERIFY_URL
      const clientId = process.env.CASHFREE_VRS_CLIENT_ID
      const clientSecret = process.env.CASHFREE_VRS_CLIENT_SECRET
      const apiVersion = process.env.CASHFREE_VRS_API_VERSION
      const requestKey = (process.env.CASHFREE_GST_REQUEST_KEY || 'GSTIN').trim()

      if (!url || !clientId || !clientSecret) {
        return NextResponse.json(
          {
            ok: false,
            error: 'cashfree_gst_not_configured',
            source: 'cashfree',
            ...buildVerificationPayload({
              verificationType: 'gst',
              provider: 'cashfree',
              ok: false,
              valid: false,
              status: 'PROVIDER_UNAVAILABLE',
              reviewRequired: true,
              submitted: { gstin, pan: toNullableString(inputPan) },
              extracted: {},
              fieldChecks: [],
              confidence: null,
              errorCode: 'cashfree_gst_not_configured',
            }),
          },
          { status: 503 }
        )
      }

      const payload: Record<string, unknown> = {}
      payload[requestKey] = gstin

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
      }
      if (apiVersion) headers['x-api-version'] = apiVersion

      const upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        cache: 'no-store',
      })

      const rawText = await upstream.text()
      let raw: any = null
      try {
        raw = rawText ? JSON.parse(rawText) : null
      } catch {
        raw = { rawText }
      }

      if (!upstream.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: 'cashfree_gst_upstream_error',
            source: 'cashfree',
            upstreamStatus: upstream.status,
            raw,
            ...buildVerificationPayload({
              verificationType: 'gst',
              provider: 'cashfree',
              ok: false,
              valid: false,
              status: 'UPSTREAM_ERROR',
              reviewRequired: true,
              submitted: { gstin, pan: toNullableString(inputPan) },
              extracted: {},
              fieldChecks: [],
              confidence: null,
              errorCode: 'cashfree_gst_upstream_error',
              raw,
            }),
          },
          { status: 502 }
        )
      }

      const resolvedGstin = String(raw?.GSTIN ?? raw?.gstin ?? gstin).trim().toUpperCase()
      const resolvedPan = gstPan(resolvedGstin)
      const valid = Boolean(
        raw?.valid ?? /exists|active/i.test(String(raw?.message ?? raw?.gst_in_status ?? ''))
      )

      const resolvedPanMatches = inputPan ? resolvedPan === inputPan : null
      return NextResponse.json(
        {
          ok: valid,
          valid,
          gstin: resolvedGstin,
          legalName: raw?.legal_name_of_business ?? raw?.legalName ?? null,
          tradeName: raw?.trade_name_of_business ?? raw?.tradeName ?? null,
          name: raw?.trade_name_of_business ?? raw?.legal_name_of_business ?? null,
          pan: resolvedPan,
          panMatches: resolvedPanMatches,
          gstStatus: raw?.gst_in_status ?? raw?.status ?? null,
          taxpayerType: raw?.taxpayer_type ?? null,
          constitutionOfBusiness: raw?.constitution_of_business ?? null,
          principalPlaceAddress: raw?.principal_place_address ?? null,
          dateOfRegistration: raw?.date_of_registration ?? null,
          lastUpdateDate: raw?.last_update_date ?? null,
          referenceId: raw?.reference_id ?? null,
          source: 'cashfree',
          raw,
          ...buildVerificationPayload({
            verificationType: 'gst',
            provider: 'cashfree',
            ok: valid,
            valid,
            status: valid ? 'VERIFIED' : 'REJECTED',
            reviewRequired: !valid || resolvedPanMatches === false,
            submitted: { gstin, pan: toNullableString(inputPan) },
            extracted: {
              gstin: resolvedGstin,
              pan: resolvedPan,
              legalName: toNullableString(raw?.legal_name_of_business ?? raw?.legalName),
              tradeName: toNullableString(raw?.trade_name_of_business ?? raw?.tradeName),
              gstStatus: toNullableString(raw?.gst_in_status ?? raw?.status),
            },
            fieldChecks: [
              {
                field: 'pan',
                submittedValue: toNullableString(inputPan),
                extractedValue: resolvedPan,
                matched: resolvedPanMatches,
                score: resolvedPanMatches === true ? 100 : resolvedPanMatches === false ? 0 : null,
                reason: resolvedPanMatches === true ? 'GST_PAN_MATCH' : resolvedPanMatches === false ? 'GST_PAN_MISMATCH' : null,
              },
            ],
            confidence: resolvedPanMatches === true ? 100 : null,
            referenceId: toNullableString(raw?.reference_id),
            raw,
          }),
        },
        { status: valid ? 200 : 422 }
      )
    }

    return NextResponse.json({
      ok: true,
      valid: true,
      gstin,
      legalName: null,
      tradeName: null,
      name: null,
      pan: embeddedPan,
      panMatches,
      source: 'local_format',
      note: 'GSTIN format validated locally; live provider disabled.',
      ...buildVerificationPayload({
        verificationType: 'gst',
        provider: 'local_format',
        ok: true,
        valid: true,
        status: 'FORMAT_VALIDATED',
        reviewRequired: true,
        submitted: { gstin, pan: toNullableString(inputPan) },
        extracted: {
          gstin,
          pan: embeddedPan,
        },
        fieldChecks: [
          {
            field: 'pan',
            submittedValue: toNullableString(inputPan),
            extractedValue: embeddedPan,
            matched: panMatches,
            score: panMatches === true ? 100 : panMatches === false ? 0 : null,
            reason: panMatches === true ? 'GST_PAN_MATCH' : panMatches === false ? 'GST_PAN_MISMATCH' : null,
          },
        ],
        confidence: panMatches === true ? 100 : null,
        referenceId: null,
      }),
    })
  } catch (error) {
    console.error('GST verify error', error)
    return NextResponse.json({
      ok: false,
      error: 'gst_verify_failed',
      ...buildVerificationPayload({
        verificationType: 'gst',
        provider: 'internal',
        ok: false,
        valid: false,
        status: 'INTERNAL_ERROR',
        reviewRequired: true,
        submitted: {},
        extracted: {},
        fieldChecks: [],
        confidence: null,
        errorCode: 'gst_verify_failed',
      }),
    }, { status: 500 })
  }
}