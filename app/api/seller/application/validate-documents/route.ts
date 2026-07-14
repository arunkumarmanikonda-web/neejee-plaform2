import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateSellerApplicationPackage } from '@/lib/seller-onboarding/application-validation';
import type { UploadedApplicationDocument } from '@/lib/seller-onboarding/document-intel';

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
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  storageKey: z.string(),
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
  pan: z.string().min(10),
  gstin: z.string().optional().nullable(),
  cin: z.string().optional().nullable(),
  msmeNumber: z.string().optional().nullable(),
  bankAccount: z.string().min(6),
  ifsc: z.string().min(5),
  documents: z.array(DocSchema).default([]),
});

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json());

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

    return NextResponse.json({
      ok: result.overallPass,
      ...result,
    });
  } catch (e: any) {
    if (e?.issues) {
      return NextResponse.json(
        {
          error: 'Invalid validation payload',
          issues: e.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: e?.message || 'Validation failed' },
      { status: 500 },
    );
  }
}