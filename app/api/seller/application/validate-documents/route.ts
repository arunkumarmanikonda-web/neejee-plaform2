import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSellerApplicationPackage } from '@/lib/seller-onboarding/application-validation';
import type { UploadedApplicationDocument } from '@/lib/seller-onboarding/document-intel';
import {
  readSellerOnboardingSession,
  verifySellerDocumentProof,
} from '@/lib/seller-onboarding/application-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DocSchema = z.object({
  uploadProof: z.string().min(20),
}).passthrough();

const BodySchema = z.object({
  businessName: z.string().min(2),
  pan: z.string().min(10),
  gstin: z.string().optional().nullable(),
  cin: z.string().optional().nullable(),
  msmeNumber: z.string().optional().nullable(),
  bankAccount: z.string().min(6),
  ifsc: z.string().min(5),
  phone: z.string().min(8),
  includeLiveVerification: z.boolean().optional().default(true),
  documents: z.array(DocSchema).default([]),
});

type KycPackageVerification = {
  ok?: boolean;
  overallStatus?: string;
  reviewRequired?: boolean;
  submitted?: Record<string, unknown>;
  verifications?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  error?: string;
} | null;

async function postPackageVerification(request: NextRequest, body: {
  businessName: string;
  pan: string;
  gstin: string | null;
  bankAccount: string;
  ifsc: string;
  phone: string;
}) {
  const url = new URL('/api/kyc/verify/package', request.url);
  const cookie = request.headers.get('cookie');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({
        businessName: body.businessName,
        name: body.businessName,
        pan: body.pan,
        gstin: body.gstin,
        bankAccount: body.bankAccount,
        ifsc: body.ifsc,
        phone: body.phone,
      }),
      cache: 'no-store',
    });

    let payload: KycPackageVerification = null;
    try {
      payload = await response.json();
    } catch {
      payload = { ok: false, error: 'invalid_package_verification_response' };
    }

    return { httpStatus: response.status, payload };
  } catch (error) {
    console.error('[seller.application.validate] package verification failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return {
      httpStatus: 500,
      payload: { ok: false, error: 'kyc_package_unavailable' } as KycPackageVerification,
    };
  }
}

function publicProviderSummary(provider: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(provider || {}).map(([key, value]: [string, any]) => [
      key,
      {
        available: Boolean(value?.available),
        ok: typeof value?.ok === 'boolean' ? value.ok : null,
        error: value?.error ? 'Provider review required' : null,
      },
    ]),
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = BodySchema.parse(await request.json());
    const onboarding = await readSellerOnboardingSession(body.phone);
    if (!onboarding) {
      return NextResponse.json(
        { error: 'Your verified mobile session has expired. Please verify the mobile OTP again.' },
        { status: 401 },
      );
    }

    const documents: UploadedApplicationDocument[] = [];
    for (const submitted of body.documents) {
      const trusted = await verifySellerDocumentProof(submitted.uploadProof, onboarding.phone);
      if (!trusted) {
        return NextResponse.json(
          { error: 'One or more uploaded documents could not be verified. Please upload them again.' },
          { status: 400 },
        );
      }
      documents.push(trusted);
    }

    const result = await validateSellerApplicationPackage({
      businessName: body.businessName,
      pan: body.pan,
      gstin: body.gstin || null,
      cin: body.cin || null,
      msmeNumber: body.msmeNumber || null,
      bankAccount: body.bankAccount,
      ifsc: body.ifsc,
      documents,
    });

    let kycPackageVerification: KycPackageVerification = null;
    let kycPackageHttpStatus: number | null = null;

    if (body.includeLiveVerification) {
      const packageResult = await postPackageVerification(request, {
        businessName: body.businessName,
        pan: body.pan,
        gstin: body.gstin || null,
        bankAccount: body.bankAccount,
        ifsc: body.ifsc,
        phone: onboarding.phone,
      });
      kycPackageVerification = packageResult.payload;
      kycPackageHttpStatus = packageResult.httpStatus;
    }

    const reviewRequired =
      !result.overallPass ||
      Boolean(result.reviewRequired) ||
      Boolean(kycPackageVerification?.reviewRequired) ||
      Boolean(kycPackageVerification && kycPackageVerification.ok === false);

    const overallStatus = !result.overallPass
      ? 'FAILED'
      : reviewRequired
        ? 'REVIEW_REQUIRED'
        : 'VERIFIED';

    return NextResponse.json({
      ok: result.overallPass,
      overallPass: result.overallPass,
      overallStatus,
      reviewRequired,
      errors: result.errors,
      warnings: result.warnings,
      checks: result.checks,
      extracted: result.extracted,
      documentsPresent: result.documentsPresent,
      provider: publicProviderSummary(result.provider as Record<string, any>),
      includeLiveVerification: body.includeLiveVerification,
      kycPackageHttpStatus,
      kycPackageVerification,
    });
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: 'Invalid validation payload', issues: error.issues },
        { status: 400 },
      );
    }

    console.error('[seller.application.validate] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Unable to validate the application right now' }, { status: 500 });
  }
}
