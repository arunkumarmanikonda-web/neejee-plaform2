import { NextResponse } from 'next/server'

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
      return NextResponse.json({ ok: false, error: 'gstin_required' }, { status: 400 })
    }

    if (!GSTIN_RE.test(gstin)) {
      return NextResponse.json(
        {
          ok: false,
          valid: false,
          error: 'invalid_gstin_format',
          gstin,
          source: 'local_format',
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
          },
          { status: 502 }
        )
      }

      const resolvedGstin = String(raw?.GSTIN ?? raw?.gstin ?? gstin).trim().toUpperCase()
      const resolvedPan = gstPan(resolvedGstin)
      const valid = Boolean(
        raw?.valid ?? /exists|active/i.test(String(raw?.message ?? raw?.gst_in_status ?? ''))
      )

      return NextResponse.json(
        {
          ok: valid,
          valid,
          gstin: resolvedGstin,
          legalName: raw?.legal_name_of_business ?? raw?.legalName ?? null,
          tradeName: raw?.trade_name_of_business ?? raw?.tradeName ?? null,
          name: raw?.trade_name_of_business ?? raw?.legal_name_of_business ?? null,
          pan: resolvedPan,
          panMatches: inputPan ? resolvedPan === inputPan : null,
          gstStatus: raw?.gst_in_status ?? raw?.status ?? null,
          taxpayerType: raw?.taxpayer_type ?? null,
          constitutionOfBusiness: raw?.constitution_of_business ?? null,
          principalPlaceAddress: raw?.principal_place_address ?? null,
          dateOfRegistration: raw?.date_of_registration ?? null,
          lastUpdateDate: raw?.last_update_date ?? null,
          referenceId: raw?.reference_id ?? null,
          source: 'cashfree',
          raw,
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
    })
  } catch (error) {
    console.error('GST verify error', error)
    return NextResponse.json({ ok: false, error: 'gst_verify_failed' }, { status: 500 })
  }
}