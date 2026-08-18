import { NextResponse } from 'next/server';
import { KycStatus, SellerDocStatus, SellerDocType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { normalizePhone, verifyOtp } from '@/lib/otp';
import type { UploadedApplicationDocument } from '@/lib/seller-onboarding/document-intel';
import { validateSellerApplicationPackage } from '@/lib/seller-onboarding/application-validation';
import { requestSellerEmailOtp } from '@/lib/seller-onboarding/email-otp';
import {
  readCookieValue,
  SELLER_PHONE_VERIFICATION_COOKIE,
  verifySellerPhoneVerificationProof,
} from '@/lib/seller-onboarding/phone-verification';
import { syncSellerKycStatus } from '@/lib/seller-onboarding/status';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DocSchema = z.object({
  docType: z.enum([
    'PAN_CARD',
    'GST_CERTIFICATE',
    'MSME_CERTIFICATE',
    'CANCELLED_CHEQUE',
    'BANK_STATEMENT',
    'CERTIFICATION',
    'OTHER',
  ]),
  title: z.string().nullable().optional(),
  fileUrl: z.string().min(1),
  fileName: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string().min(1),
  storageKey: z.string().min(1),
  extractedTextPreview: z.string().default(''),
  extractedFields: z.object({
    pans: z.array(z.string()).default([]),
    gstins: z.array(z.string()).default([]),
    cins: z.array(z.string()).default([]),
    ifscs: z.array(z.string()).default([]),
    bankAccounts: z.array(z.string()).default([]),
    msmeNumbers: z.array(z.string()).default([]),
  }),
});

const BodySchema = z.object({
  businessName: z.string().min(2),
  contactName: z.string().min(2),
  // `email` remains the communication/login email for backward compatibility.
  email: z.string().email(),
  // New UI sends the official business email separately. Old in-progress forms
  // are allowed to omit it so applicants do not lose already-uploaded documents.
  officialEmail: z.string().email().optional().nullable(),
  phone: z.string().min(8),
  phoneOtp: z.string().optional(),
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
    phone: string | null;
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
    return {
      httpStatus: 500,
      payload: {
        ok: false,
        error: error instanceof Error ? error.message : 'kyc_package_fetch_failed',
      },
    };
  }
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeUpper(value: string | null | undefined): string | null {
  const v = String(value || '').trim().toUpperCase();
  return v || null;
}

function normalizeDocType(value: UploadedApplicationDocument['docType']): SellerDocType {
  return value as SellerDocType;
}

function mobileOtpErrorMessage(reason: string): string {
  switch (reason) {
    case 'expired':
      return 'This mobile OTP has expired. Go back to Contact and request a new OTP.';
    case 'wrong_code':
      return 'The mobile OTP entered is incorrect.';
    case 'max_attempts':
      return 'Too many incorrect mobile OTP attempts. Request a new OTP.';
    case 'no_active_otp':
      return 'No active mobile OTP was found. Go back to Contact and request a new OTP.';
    default:
      return 'Mobile OTP verification failed.';
  }
}

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());

    const communicationEmail = normalizeEmail(body.email);
    const officialEmail = normalizeEmail(body.officialEmail) || communicationEmail;
    const phone = normalizePhone(body.phone);

    if (!phone) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
    }

    const verificationCookie = readCookieValue(
      request.headers.get('cookie'),
      SELLER_PHONE_VERIFICATION_COOKIE,
    );
    const phoneVerification = verifySellerPhoneVerificationProof(
      verificationCookie,
      phone,
    );

    if (!phoneVerification.ok) {
      const legacyCode = String(body.phoneOtp || '').trim();
      if (/^\d{6}$/.test(legacyCode)) {
        const legacyOtpResult = await verifyOtp({
          phone,
          purpose: 'signup',
          code: legacyCode,
        });
        if (!legacyOtpResult.ok) {
          return NextResponse.json(
            {
              error: mobileOtpErrorMessage(legacyOtpResult.reason),
              reason: legacyOtpResult.reason,
            },
            { status: 400 },
          );
        }
      } else {
        return NextResponse.json(
          {
            error:
              phoneVerification.reason === 'verification_expired'
                ? 'Mobile verification has expired. Go back to Contact, request a new OTP and press Continue to verify it.'
                : phoneVerification.reason === 'phone_changed'
                  ? 'The mobile number has changed since OTP verification. Go back to Contact and verify the current number.'
                  : 'Mobile number is not verified. Go back to Contact, enter the OTP and press Continue.',
            reason: phoneVerification.reason,
          },
          { status: 400 },
        );
      }
    }

    const documents: UploadedApplicationDocument[] = body.documents.map((doc) => ({
      docType: doc.docType,
      title: doc.title ?? null,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      storageKey: doc.storageKey,
      extractedTextPreview: doc.extractedTextPreview,
      extractedFields: {
        pans: doc.extractedFields.pans,
        gstins: doc.extractedFields.gstins,
        cins: doc.extractedFields.cins,
        ifscs: doc.extractedFields.ifscs,
        bankAccounts: doc.extractedFields.bankAccounts,
        msmeNumbers: doc.extractedFields.msmeNumbers,
      },
    }));

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
        { error: 'KYC validation failed', validation },
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
      Boolean(kycPackageVerification?.reviewRequired) ||
      Boolean(kycPackageVerification && kycPackageVerification.ok === false);
    const overallStatus = reviewRequired ? 'REVIEW_REQUIRED' : 'VERIFIED';
    const now = new Date();

    // Identity resolution must start with the already-verified phone number.
    // Upserting only by email caused the production unique(phone) failure when
    // the same seller returned with a different/new communication email.
    const [userByPhone, userByEmail] = await Promise.all([
      prisma.user.findUnique({ where: { phone } }),
      prisma.user.findUnique({ where: { email: communicationEmail } }),
    ]);

    if (userByPhone && userByEmail && userByPhone.id !== userByEmail.id) {
      return NextResponse.json(
        {
          error:
            'This mobile number and communication email belong to different existing NEEJEE accounts. Please use the email already linked to this mobile number or contact NEEJEE support.',
        },
        { status: 409 },
      );
    }

    // Applying does NOT grant Seller Studio access. Existing roles are preserved,
    // and brand-new applicants remain ordinary CUSTOMER users until an admin
    // explicitly approves the Seller record. Approval is the only role-promotion point.
    let user;
    if (userByPhone) {
      user = await prisma.user.update({
        where: { id: userByPhone.id },
        data: {
          email: communicationEmail,
          name: body.contactName,
          phone,
          phoneVerified: true,
          phoneVerifiedAt: now,
          // A changed communication email must be verified again.
          emailVerified:
            userByPhone.email === communicationEmail
              ? userByPhone.emailVerified
              : null,
        },
      });
    } else if (userByEmail) {
      user = await prisma.user.update({
        where: { id: userByEmail.id },
        data: {
          name: body.contactName,
          phone,
          phoneVerified: true,
          phoneVerifiedAt: now,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          email: communicationEmail,
          name: body.contactName,
          phone,
          emailVerified: null,
          phoneVerified: true,
          phoneVerifiedAt: now,
        },
      });
    }

    const [sellerByUser, sellerByEmail] = await Promise.all([
      prisma.seller.findUnique({
        where: { userId: user.id },
        select: { id: true, autoKycSummary: true, kycStatus: true },
      }),
      prisma.seller.findUnique({
        where: { email: communicationEmail },
        select: { id: true, autoKycSummary: true, kycStatus: true },
      }),
    ]);

    if (sellerByUser && sellerByEmail && sellerByUser.id !== sellerByEmail.id) {
      return NextResponse.json(
        {
          error:
            'The verified mobile number and communication email are linked to different seller records. Please contact NEEJEE support before continuing.',
        },
        { status: 409 },
      );
    }

    const existingSeller = sellerByUser || sellerByEmail;
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
      ]
        .filter(Boolean)
        .join(', '),
    };

    const nextAutoKycSummary = {
      ...previousSummary,
      ...(validation as any),
      overallStatus,
      reviewRequired,
      includeLiveVerification: body.includeLiveVerification,
      kycPackageHttpStatus,
      liveVerification: kycPackageVerification,
      onboarding: {
        ...(previousSummary?.onboarding && typeof previousSummary.onboarding === 'object'
          ? previousSummary.onboarding
          : {}),
        ...onboardingAddress,
        officialEmail,
        communicationEmail,
        cin: normalizeUpper(body.cin),
        msmeNumber: normalizeUpper(body.msmeNumber),
        applicationSubmittedAt: now.toISOString(),
      },
    };

    const finalSellerStates = new Set(['APPROVED', 'REJECTED', 'SUSPENDED']);
    const nextKycStatus =
      existingSeller && finalSellerStates.has(String(existingSeller.kycStatus))
        ? existingSeller.kycStatus
        : KycStatus.PENDING;

    const seller = existingSeller
      ? await prisma.seller.update({
          where: { id: existingSeller.id },
          data: {
            userId: user.id,
            businessName: body.businessName,
            contactName: body.contactName,
            // Existing seller notification flows use Seller.email, so keep this
            // as the communication email. Official email is separately retained
            // in autoKycSummary.onboarding.officialEmail.
            email: communicationEmail,
            phone,
            pan: normalizeUpper(body.pan),
            gstin: normalizeUpper(body.gstin),
            bankAccount: String(body.bankAccount || '').trim(),
            ifsc: String(body.ifsc || '').trim().toUpperCase(),
            bankName: String(body.bankName || '').trim(),
            autoKycPassed: !reviewRequired,
            autoKycSummary: nextAutoKycSummary as any,
            kycStatus: nextKycStatus,
          },
          select: {
            id: true,
            email: true,
            contactName: true,
            kycStatus: true,
          },
        })
      : await prisma.seller.create({
          data: {
            userId: user.id,
            businessName: body.businessName,
            contactName: body.contactName,
            email: communicationEmail,
            phone,
            pan: normalizeUpper(body.pan),
            gstin: normalizeUpper(body.gstin),
            bankAccount: String(body.bankAccount || '').trim(),
            ifsc: String(body.ifsc || '').trim().toUpperCase(),
            bankName: String(body.bankName || '').trim(),
            autoKycPassed: !reviewRequired,
            autoKycSummary: nextAutoKycSummary as any,
            kycStatus: KycStatus.PENDING,
          },
          select: {
            id: true,
            email: true,
            contactName: true,
            kycStatus: true,
          },
        });

    const docTypes = Array.from(
      new Set(documents.map((doc) => normalizeDocType(doc.docType))),
    );

    if (docTypes.length > 0) {
      await prisma.sellerDocument.updateMany({
        where: {
          sellerId: seller.id,
          docType: { in: docTypes },
          status: SellerDocStatus.SUBMITTED,
        },
        data: {
          status: SellerDocStatus.SUPERSEDED,
          reviewedAt: now,
          reviewNote: 'Superseded by new seller application submission',
        },
      });
    }

    if (documents.length > 0) {
      await prisma.sellerDocument.createMany({
        data: documents.map((doc) => ({
          sellerId: seller.id,
          docType: normalizeDocType(doc.docType),
          title: doc.title ?? null,
          fileName: doc.fileName,
          fileUrl: doc.fileUrl,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          status: SellerDocStatus.SUBMITTED,
          uploadedByUserId: user.id,
          uploadedOnBehalf: false,
        })),
      });
    }

    await syncSellerKycStatus(seller.id);

    let emailOtpRequested = false;
    let emailOtpError: string | null = null;

    try {
      const emailOtpResult = await requestSellerEmailOtp({
        sellerId: seller.id,
        email: communicationEmail,
        recipientName: seller.contactName || communicationEmail,
      });
      emailOtpRequested = !!emailOtpResult.ok;
    } catch (e: any) {
      emailOtpRequested = false;
      emailOtpError = e?.message || 'Failed to send email OTP';
    }

    const refreshedSeller = await prisma.seller.findUnique({
      where: { id: seller.id },
      select: {
        id: true,
        kycStatus: true,
        autoKycPassed: true,
      },
    });

    const response = NextResponse.json({
      ok: true,
      sellerId: seller.id,
      userId: user.id,
      kycStatus: refreshedSeller?.kycStatus || seller.kycStatus,
      autoKycPassed: !!refreshedSeller?.autoKycPassed,
      applicationSubmittedAt: now,
      communicationEmail,
      officialEmail,
      emailOtpRequested,
      emailOtpError,
      validation,
      nextStep: 'verify_email_otp',
    });

    response.cookies.set(SELLER_PHONE_VERIFICATION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        { error: 'Invalid seller application payload', issues: e.issues },
        { status: 400 },
      );
    }

    console.error('[seller-application-submit]', e);
    return NextResponse.json(
      { error: e?.message || 'Failed to submit seller application' },
      { status: 500 },
    );
  }
}
