import { NextResponse } from 'next/server'
import { averageScore, buildVerificationPayload, toNullableString } from '@/lib/kyc/normalized-verification'

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

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

function last4(value: string) {
  return value.length >= 4 ? value.slice(-4) : value
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const bankAccount = String(body?.bankAccount ?? body?.bank_account ?? '').trim()
    const ifsc = String(body?.ifsc ?? '').trim().toUpperCase()
    const name = String(body?.name ?? body?.accountHolderName ?? '').trim()
    const phone = String(body?.phone ?? '').trim()

    if (!bankAccount) {
      return NextResponse.json({
        ok: false,
        error: 'bank_account_required',
        ...buildVerificationPayload({
          verificationType: 'bank',
          provider: 'request_validation',
          ok: false,
          valid: false,
          status: 'INPUT_INVALID',
          reviewRequired: false,
          submitted: {
            bankAccountLast4: toNullableString(last4(bankAccount)),
            ifsc: toNullableString(ifsc),
            name: toNullableString(name),
            phone: toNullableString(phone),
          },
          extracted: {},
          fieldChecks: [],
          confidence: null,
          errorCode: 'bank_account_required',
        }),
      }, { status: 400 })
    }

    if (!ifsc || !IFSC_RE.test(ifsc)) {
      return NextResponse.json({
        ok: false,
        valid: false,
        error: 'invalid_ifsc_format',
        ifsc,
        source: 'local_format',
        ...buildVerificationPayload({
          verificationType: 'bank',
          provider: 'local_format',
          ok: false,
          valid: false,
          status: 'INPUT_INVALID',
          reviewRequired: false,
          submitted: {
            bankAccountLast4: toNullableString(last4(bankAccount)),
            ifsc: toNullableString(ifsc),
            name: toNullableString(name),
            phone: toNullableString(phone),
          },
          extracted: { ifsc: toNullableString(ifsc) },
          fieldChecks: [
            {
              field: 'ifsc',
              submittedValue: toNullableString(ifsc),
              extractedValue: toNullableString(ifsc),
              matched: false,
              score: null,
              reason: 'invalid_ifsc_format',
            },
          ],
          confidence: null,
          errorCode: 'invalid_ifsc_format',
        }),
      }, { status: 400 })
    }

    if (isMockMode()) {
      const mockNameScore = name ? 100 : null
      return NextResponse.json({
        ok: true,
        valid: true,
        bankAccountLast4: last4(bankAccount),
        accountLast4: last4(bankAccount),
        last4: last4(bankAccount),
        ifsc,
        bankName: 'TEST BANK',
        name: name || 'TEST HOLDER',
        registeredName: name || 'TEST HOLDER',
        accountStatus: 'VALID',
        accountStatusCode: 'ACCOUNT_IS_VALID',
        nameMatchScore: mockNameScore,
        nameMatchResult: name ? 'DIRECT_MATCH' : null,
        source: 'mock',
        ...buildVerificationPayload({
          verificationType: 'bank',
          provider: 'mock',
          ok: true,
          valid: true,
          status: 'VERIFIED',
          reviewRequired: false,
          submitted: {
            bankAccountLast4: toNullableString(last4(bankAccount)),
            ifsc: toNullableString(ifsc),
            name: toNullableString(name),
            phone: toNullableString(phone),
          },
          extracted: {
            bankAccountLast4: toNullableString(last4(bankAccount)),
            ifsc: toNullableString(ifsc),
            bankName: 'TEST BANK',
            registeredName: toNullableString(name || 'TEST HOLDER'),
            accountStatus: 'VALID',
            accountStatusCode: 'ACCOUNT_IS_VALID',
          },
          fieldChecks: [
            {
              field: 'name',
              submittedValue: toNullableString(name),
              extractedValue: toNullableString(name || 'TEST HOLDER'),
              matched: name ? true : null,
              score: mockNameScore,
              reason: name ? 'DIRECT_MATCH' : null,
            },
          ],
          confidence: mockNameScore,
          referenceId: null,
        }),
      })
    }

    const provider = (process.env.BANK_KYC_PROVIDER || 'manual').trim().toLowerCase()

    if (provider === 'cashfree') {
      const url = process.env.CASHFREE_BANK_VERIFY_URL
      const clientId = process.env.CASHFREE_VRS_CLIENT_ID
      const clientSecret = process.env.CASHFREE_VRS_CLIENT_SECRET

      if (!url || !clientId || !clientSecret) {
        return NextResponse.json({
          ok: false,
          error: 'cashfree_bank_not_configured',
          source: 'cashfree',
          ...buildVerificationPayload({
            verificationType: 'bank',
            provider: 'cashfree',
            ok: false,
            valid: false,
            status: 'PROVIDER_UNAVAILABLE',
            reviewRequired: true,
            submitted: {
              bankAccountLast4: toNullableString(last4(bankAccount)),
              ifsc: toNullableString(ifsc),
              name: toNullableString(name),
              phone: toNullableString(phone),
            },
            extracted: {},
            fieldChecks: [],
            confidence: null,
            errorCode: 'cashfree_bank_not_configured',
          }),
        }, { status: 503 })
      }

      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-client-id': clientId,
          'x-client-secret': clientSecret,
        },
        body: JSON.stringify({
          bank_account: bankAccount,
          ifsc,
          ...(name ? { name } : {}),
          ...(phone ? { phone } : {}),
        }),
        cache: 'no-store',
      })

      const rawText = await upstream.text()
      let raw: any = null
      try { raw = rawText ? JSON.parse(rawText) : null } catch { raw = { rawText } }

      if (!upstream.ok) {
        return NextResponse.json({
          ok: false,
          error: 'cashfree_bank_upstream_error',
          source: 'cashfree',
          upstreamStatus: upstream.status,
          raw,
          ...buildVerificationPayload({
            verificationType: 'bank',
            provider: 'cashfree',
            ok: false,
            valid: false,
            status: 'UPSTREAM_ERROR',
            reviewRequired: true,
            submitted: {
              bankAccountLast4: toNullableString(last4(bankAccount)),
              ifsc: toNullableString(ifsc),
              name: toNullableString(name),
              phone: toNullableString(phone),
            },
            extracted: {},
            fieldChecks: [],
            confidence: null,
            errorCode: 'cashfree_bank_upstream_error',
            raw,
          }),
        }, { status: 502 })
      }

      const accountStatus = String(raw?.account_status ?? '').trim()
      const accountStatusCode = String(raw?.account_status_code ?? '').trim()
      const valid = /valid/i.test(accountStatus) || accountStatusCode === 'ACCOUNT_IS_VALID'
      const registeredName = raw?.name_at_bank ?? raw?.registered_name ?? null

      const nameMatchScore = toNumberOrNull(raw?.name_match_score)
      return NextResponse.json({
        ok: valid,
        valid,
        bankAccountLast4: last4(bankAccount),
        accountLast4: last4(bankAccount),
        last4: last4(bankAccount),
        ifsc: raw?.ifsc_details?.ifsc ?? ifsc,
        bankName: raw?.bank_name ?? raw?.ifsc_details?.bank ?? null,
        branch: raw?.branch ?? raw?.ifsc_details?.branch ?? null,
        city: raw?.city ?? raw?.ifsc_details?.city ?? null,
        micr: raw?.micr ?? raw?.ifsc_details?.micr ?? null,
        name: registeredName,
        registeredName,
        accountStatus,
        accountStatusCode,
        utr: raw?.utr ?? null,
        referenceId: raw?.reference_id ?? null,
        nameMatchScore,
        nameMatchResult: raw?.name_match_result ?? null,
        source: 'cashfree',
        raw,
        ...buildVerificationPayload({
          verificationType: 'bank',
          provider: 'cashfree',
          ok: valid,
          valid,
          status: valid ? 'VERIFIED' : 'REJECTED',
          reviewRequired: !valid,
          submitted: {
            bankAccountLast4: toNullableString(last4(bankAccount)),
            ifsc: toNullableString(ifsc),
            name: toNullableString(name),
            phone: toNullableString(phone),
          },
          extracted: {
            bankAccountLast4: toNullableString(last4(bankAccount)),
            ifsc: toNullableString(raw?.ifsc_details?.ifsc ?? ifsc),
            bankName: toNullableString(raw?.bank_name ?? raw?.ifsc_details?.bank),
            branch: toNullableString(raw?.branch ?? raw?.ifsc_details?.branch),
            city: toNullableString(raw?.city ?? raw?.ifsc_details?.city),
            micr: toNullableString(raw?.micr ?? raw?.ifsc_details?.micr),
            registeredName: toNullableString(registeredName),
            accountStatus: toNullableString(accountStatus),
            accountStatusCode: toNullableString(accountStatusCode),
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
            {
              field: 'ifsc',
              submittedValue: toNullableString(ifsc),
              extractedValue: toNullableString(raw?.ifsc_details?.ifsc ?? ifsc),
              matched: toNullableString(raw?.ifsc_details?.ifsc ?? ifsc) === toNullableString(ifsc),
              score: toNullableString(raw?.ifsc_details?.ifsc ?? ifsc) === toNullableString(ifsc) ? 100 : 0,
              reason: toNullableString(raw?.ifsc_details?.ifsc ?? ifsc) === toNullableString(ifsc) ? 'BANK_IFSC_MATCH' : 'BANK_IFSC_MISMATCH',
            },
          ],
          confidence: averageScore([nameMatchScore, toNullableString(raw?.ifsc_details?.ifsc ?? ifsc) === toNullableString(ifsc) ? 100 : 0]),
          referenceId: toNullableString(raw?.reference_id),
          raw,
        }),
      }, { status: valid ? 200 : 422 })
    }

    if (provider === 'manual') {
      return NextResponse.json({
        ok: true,
        valid: true,
        pendingManualDocumentReview: true,
        bankAccountLast4: last4(bankAccount),
        accountLast4: last4(bankAccount),
        last4: last4(bankAccount),
        ifsc,
        name: name || null,
        registeredName: null,
        source: 'manual_document_match',
        note: 'API bank verification disabled; rely on cancelled cheque OCR/document review.',
        ...buildVerificationPayload({
          verificationType: 'bank',
          provider: 'manual_document_match',
          ok: true,
          valid: true,
          status: 'MANUAL_REVIEW_REQUIRED',
          reviewRequired: true,
          submitted: {
            bankAccountLast4: toNullableString(last4(bankAccount)),
            ifsc: toNullableString(ifsc),
            name: toNullableString(name),
            phone: toNullableString(phone),
          },
          extracted: {
            bankAccountLast4: toNullableString(last4(bankAccount)),
            ifsc: toNullableString(ifsc),
          },
          fieldChecks: [
            {
              field: 'name',
              submittedValue: toNullableString(name),
              extractedValue: null,
              matched: null,
              score: null,
              reason: 'MANUAL_DOCUMENT_REVIEW_REQUIRED',
            },
          ],
          confidence: null,
          referenceId: null,
        }),
      })
    }

    return NextResponse.json({
      ok: false,
      error: 'unsupported_bank_kyc_provider',
      source: provider,
      ...buildVerificationPayload({
        verificationType: 'bank',
        provider,
        ok: false,
        valid: false,
        status: 'INPUT_INVALID',
        reviewRequired: true,
        submitted: {
          bankAccountLast4: toNullableString(last4(bankAccount)),
          ifsc: toNullableString(ifsc),
          name: toNullableString(name),
          phone: toNullableString(phone),
        },
        extracted: {},
        fieldChecks: [],
        confidence: null,
        errorCode: 'unsupported_bank_kyc_provider',
      }),
    }, { status: 400 })
  } catch (error) {
    console.error('Bank verify error', error)
    return NextResponse.json({
      ok: false,
      error: 'bank_verify_failed',
      ...buildVerificationPayload({
        verificationType: 'bank',
        provider: 'internal',
        ok: false,
        valid: false,
        status: 'INTERNAL_ERROR',
        reviewRequired: true,
        submitted: {},
        extracted: {},
        fieldChecks: [],
        confidence: null,
        errorCode: 'bank_verify_failed',
      }),
    }, { status: 500 })
  }
}