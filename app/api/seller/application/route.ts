import { NextResponse } from 'next/server';
import { KycStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/otp';
import type { UploadedApplicationDocument } from '@/lib/seller-onboarding/document-intel';
import { validateSellerApplicationPackage } from '@/lib/seller-onboarding/application-validation';
import { requestSellerEmailOtp } from '@/lib/seller-onboarding/email-otp';
import { syncSellerKycStatus } from '@/lib/seller-onboarding/status';
import {
  readSellerOnboardingSession,
  verifySellerDocumentProof,
} from '@/lib/seller-onboarding/application-session';
import { deleteFile, privateSellerStorageRef } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DocSchema = z.object({
  uploadProof: z.string().min(20),
}).passthrough();

const BodySchema = z.object({
  businessName: z.string().min(2),
  contactName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  pan: z.string().min(10),
  gstin: z.string().optional().nullable(),
  cin: z.string().optional().nullable(),
  msmeNumber: z.string().optional().nullable(),
  bankAccount: z.string().min(6),
  ifsc: z.string().min(5),
  bankName: z.string().min(2),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
  includeLiveVerification: z.boolean().optional().default(true),
  documents: z.array(DocSchema).min(1),
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

async function postPackageVerification(
  request: Request,
  body: {
    businessName: string;
    pan: string;
    gstin: string | null;
    bankAccount: string;
    ifsc: string;
    phone: string;
  },
) {
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
    console.error('[seller.application] package verification failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return {
      httpStatus: 500,
      payload: { ok: false, error: 'kyc_package_unavailable' } as KycPackageVerification,
    };
  }
}

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeUpper(value: string | null | undefined): string | null {
  const v = String(value || '').trim().toUpperCase();
  return v || null;
}

function publicValidation(validation: any) {
  return {
    overallPass: Boolean(validation?.overallPass),
    reviewRequired: Boolean(validation?.reviewRequired),
    errors: Array.isArray(validation?.errors) ? validation.errors : [],
    warnings: Array.isArray(validation?.warnings) ? validation.warnings : [],
    extracted: validation?.extracted || {},
    documentsPresent: validation?.documentsPresent || {},
  };
}

function pendingDocumentPayload(documents: UploadedApplicationDocument[]) {
  return documents.map((doc) => ({
    docType: doc.docType,
    title: doc.title ?? null,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    storageKey: doc.storageKey,
  }));
}

async function cleanupReplacedPendingDocuments(previous: any[], current: UploadedApplicationDocument[]) {
  const currentKeys = new Set(current.map((doc) => doc.storageKey));
  const stale = (Array.isArray(previous) ? previous : [])
    .map((doc) => String(doc?.storageKey || ''))
    .filter((key) => key && !currentKeys.has(key));

  await Promise.allSettled(stale.map((key) => deleteFile(privateSellerStorageRef(key))));
}

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);

    if (!phone) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
    }

    const onboarding = await readSellerOnboardingSession(phone);
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

    const validation = await validateSellerApplicationPackage({
      businessName: body.businessName,
      pan: body.pan,
      gstin: body.gstin || null,
      cin: body.cin || null,
      msmeNumber: body.msmeNumber || null,
      bankAccount: body.bankAccount,
      ifsc: body.ifsc,
      documents,
    });

    if (!validation.overallPass) {
      return NextResponse.json(
        { error: 'KYC validation found document mismatches', validation: publicValidation(validation) },
        { status: 400 },
      );
    }

    let kycPackageVerification: KycPackageVerification = null;
    let kycPackageHttpStatus: number | null = null;

    if (body.includeLiveVerification) {
      const packageResult = await postPackageVerification(request, {
        businessName: body.businessName,
        pan: body.pan,
        gstin: body.gstin || null,
        bankAccount: body.bankAccount,
        ifsc: body.ifsc,
        phone,
      });
      kycPackageVerification = packageResult.payload;
      kycPackageHttpStatus = packageResult.httpStatus;
    }

    const reviewRequired =
      Boolean(validation.reviewRequired) ||
      Boolean(kycPackageVerification?.reviewRequired) ||
      Boolean(kycPackageVerification && kycPackageVerification.ok === false);

    const autoKycPassed =
      validation.overallPass &&
      (!kycPackageVerification || kycPackageVerification.ok !== false);

    const overallStatus = !autoKycPassed
      ? 'REVIEW_REQUIRED'
      : reviewRequired
        ? 'REVIEW_REQUIRED'
        : 'VERIFIED';

    const now = new Date();
    const existingSeller = await prisma.seller.findFirst({
      where: { email, phone },
      select: {
        id: true,
        userId: true,
        autoKycSummary: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const previousSummary =
      existingSeller?.autoKycSummary && typeof existingSeller.autoKycSummary === 'object'
        ? (existingSeller.autoKycSummary as any)
        : {};

    const onboardingAddress = {
      addressLine1: String(body.addressLine1 || '').trim(),
      addressLine2: String(body.addressLine2 || '').trim(),
      city: String(body.city || '').trim(),
      state: String(body.state || '').trim(),
      pincode: String(body.pincode || '').trim(),
      address: [
        String(body.addressLine1 || '').trim(),
        String(body.addressLine2 || '').trim(),
        String(body.city || '').trim(),
        String(body.state || '').trim(),
        String(body.pincode || '').trim(),
      ].filter(Boolean).join(', '),
    };

    const nextAutoKycSummary = {
      ...previousSummary,
      ...publicValidation(validation),
      overallStatus,
      reviewRequired,
      includeLiveVerification: body.includeLiveVerification,
      kycPackageHttpStatus,
      liveVerification: kycPackageVerification,
      pendingDocuments: pendingDocumentPayload(documents),
      pendingDocumentsCreatedAt: now.toISOString(),
      onboarding: {
        ...(previousSummary?.onboarding && typeof previousSummary.onboarding === 'object'
          ? previousSummary.onboarding
          : {}),
        ...onboardingAddress,
      },
    };

    const seller = existingSeller
      ? await prisma.seller.update({
          where: { id: existingSeller.id },
          data: {
            businessName: body.businessName,
            contactName: body.contactName,
            email,
            phone,
            pan: normalizeUpper(body.pan),
            gstin: normalizeUpper(body.gstin),
            cin: normalizeUpper(body.cin),
            msmeNumber: normalizeUpper(body.msmeNumber),
            bankAccount: String(body.bankAccount || '').trim(),
            ifsc: String(body.ifsc || '').trim().toUpperCase(),
            bankName: String(body.bankName || '').trim(),
            applicationSubmittedAt: now,
            autoKycPassed,
            autoKycSummary: nextAutoKycSummary as any,
            kycStatus: KycStatus.PENDING,
          },
          select: { id: true, email: true, contactName: true, kycStatus: true },
        })
      : await prisma.seller.create({
          data: {
            businessName: body.businessName,
            contactName: body.contactName,
            email,
            phone,
            pan: normalizeUpper(body.pan),
            gstin: normalizeUpper(body.gstin),
            cin: normalizeUpper(body.cin),
            msmeNumber: normalizeUpper(body.msmeNumber),
            bankAccount: String(body.bankAccount || '').trim(),
            ifsc: String(body.ifsc || '').trim().toUpperCase(),
            bankName: String(body.bankName || '').trim(),
            applicationSubmittedAt: now,
            autoKycPassed,
            autoKycSummary: nextAutoKycSummary as any,
            kycStatus: KycStatus.PENDING,
          },
          select: { id: true, email: true, contactName: true, kycStatus: true },
        });

    if (existingSeller) {
      await cleanupReplacedPendingDocuments(previousSummary?.pendingDocuments, documents);
    }

    await syncSellerKycStatus(seller.id);

    let emailOtpRequested = false;
    let emailOtpError: string | null = null;
    try {
      const emailOtpResult = await requestSellerEmailOtp({
        sellerId: seller.id,
        email: seller.email,
        recipientName: seller.contactName || seller.email,
      });
      emailOtpRequested = !!emailOtpResult.ok;
    } catch (error) {
      console.error('[seller.application] email OTP request failed', {
        sellerId: seller.id,
        message: error instanceof Error ? error.message : 'unknown_error',
      });
      emailOtpError = 'Email verification code could not be sent automatically. Please use resend.';
    }

    const refreshedSeller = await prisma.seller.findUnique({
      where: { id: seller.id },
      select: { id: true, kycStatus: true, autoKycPassed: true, applicationSubmittedAt: true },
    });

    return NextResponse.json({
      ok: true,
      sellerId: seller.id,
      kycStatus: refreshedSeller?.kycStatus || seller.kycStatus,
      autoKycPassed: !!refreshedSeller?.autoKycPassed,
      applicationSubmittedAt: refreshedSeller?.applicationSubmittedAt || now,
      emailOtpRequested,
      emailOtpError,
      validation: publicValidation(validation),
      reviewRequired,
      overallStatus,
      nextStep: 'verify_email_otp',
    });
  } catch (error: any) {
    if (error?.issues) {
      return NextResponse.json(
        { error: 'Invalid seller application payload', issues: error.issues },
        { status: 400 },
      );
    }

    console.error('[seller.application] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Unable to submit the seller application right now' }, { status: 500 });
  }
}
