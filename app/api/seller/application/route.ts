import { NextResponse } from 'next/server';
import { KycStatus, Role, SellerDocStatus, SellerDocType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { normalizePhone, verifyOtp } from '@/lib/otp';
import type { UploadedApplicationDocument } from '@/lib/seller-onboarding/document-intel';
import { validateSellerApplicationPackage } from '@/lib/seller-onboarding/application-validation';
import { requestSellerEmailOtp } from '@/lib/seller-onboarding/email-otp';
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
  email: z.string().email(),
  phone: z.string().min(8),
  phoneOtp: z.string().regex(/^\d{4,8}$/),
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
  documents: z.array(DocSchema).min(1),
});

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeUpper(value: string | null | undefined): string | null {
  const v = String(value || '').trim().toUpperCase();
  return v || null;
}

function normalizeDocType(value: UploadedApplicationDocument['docType']): SellerDocType {
  return value as SellerDocType;
}

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());

    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);

    if (!phone) {
      return NextResponse.json({ error: 'Invalid mobile number' }, { status: 400 });
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
        {
          error: 'KYC validation failed',
          validation,
        },
        { status: 400 },
      );
    }

    const otpResult = await verifyOtp({
      phone,
      purpose: 'signup',
      code: String(body.phoneOtp || '').trim(),
    });

    if (!otpResult.ok) {
      return NextResponse.json(
        {
          error: 'Mobile OTP verification failed',
          reason: otpResult.reason,
        },
        { status: 400 },
      );
    }

    const now = new Date();

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: body.contactName,
        phone,
        role: Role.SELLER,
        phoneVerified: true,
        phoneVerifiedAt: now,
      },
      create: {
        email,
        name: body.contactName,
        phone,
        role: Role.SELLER,
        emailVerified: null,
        phoneVerified: true,
        phoneVerifiedAt: now,
      },
    });

    const existingSeller = await prisma.seller.findFirst({
      where: {
        OR: [
          { userId: user.id },
          { email },
        ],
      },
      select: {
        id: true,
        autoKycSummary: true,
      },
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
      ...(validation as any),
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
            userId: user.id,
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
            autoKycPassed: true,
            autoKycSummary: nextAutoKycSummary as any,
            kycStatus: KycStatus.PENDING,
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
            autoKycPassed: true,
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

    const docTypes = Array.from(new Set(documents.map((doc) => normalizeDocType(doc.docType))));

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
        email: seller.email,
        recipientName: seller.contactName || seller.email,
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
        applicationSubmittedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      sellerId: seller.id,
      userId: user.id,
      kycStatus: refreshedSeller?.kycStatus || seller.kycStatus,
      autoKycPassed: !!refreshedSeller?.autoKycPassed,
      applicationSubmittedAt: refreshedSeller?.applicationSubmittedAt || now,
      emailOtpRequested,
      emailOtpError,
      validation,
      nextStep: 'verify_email_otp',
    });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        {
          error: 'Invalid seller application payload',
          issues: e.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: e?.message || 'Failed to submit seller application' },
      { status: 500 },
    );
  }
}
