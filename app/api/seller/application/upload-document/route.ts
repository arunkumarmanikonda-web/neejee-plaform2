import path from 'path';
import { NextResponse } from 'next/server';
import {
  extractStructuredFields,
  extractTextFromDocument,
  type ApplicationDocType,
  type UploadedApplicationDocument,
} from '@/lib/seller-onboarding/document-intel';
import {
  createSellerDocumentProof,
  readSellerOnboardingSession,
  sellerApplicantScope,
  verifySellerDocumentProof,
} from '@/lib/seller-onboarding/application-session';
import {
  deleteFile,
  makeUploadPath,
  privateSellerStorageRef,
  storageConfigured,
  uploadPrivateSellerFile,
} from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_DOC_TYPES: ApplicationDocType[] = [
  'PAN_CARD',
  'GST_CERTIFICATE',
  'MSME_CERTIFICATE',
  'CANCELLED_CHEQUE',
  'BANK_STATEMENT',
  'CERTIFICATION',
  'OTHER',
];

const MIME_BY_EXTENSION: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  '.txt': ['text/plain'],
};

function safeTitle(value: unknown): string | null {
  const title = String(value || '').trim().slice(0, 120);
  return title || null;
}

function validSignature(buffer: Buffer, ext: string): boolean {
  if (ext === '.pdf') return buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (ext === '.png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === '.webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (ext === '.csv' || ext === '.txt') {
    const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
    return !sample.includes(0);
  }
  return false;
}

async function extractSafely(buffer: Buffer, mimeType: string, fileName: string) {
  try {
    const text = await extractTextFromDocument({ buffer, mimeType, fileName });
    return { text, warning: null as string | null };
  } catch (error) {
    console.warn('[seller.application.upload-document] extraction failed', {
      fileName,
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return {
      text: '',
      warning: 'The document was stored securely, but automated text extraction could not complete. It can still be reviewed manually.',
    };
  }
}

export async function POST(request: Request) {
  const onboarding = await readSellerOnboardingSession();
  if (!onboarding) {
    return NextResponse.json(
      { error: 'Verify your mobile number before uploading KYC documents' },
      { status: 401 },
    );
  }

  if (!storageConfigured()) {
    return NextResponse.json(
      { error: 'Secure document storage is temporarily unavailable' },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const docType = String(form.get('docType') || '').trim() as ApplicationDocType;
    const title = safeTitle(form.get('title'));
    const file = form.get('file');

    if (!ALLOWED_DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }
    if (!file.size || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: file.size > MAX_FILE_SIZE ? 'File must be 8 MB or smaller' : 'The selected file is empty' },
        { status: file.size > MAX_FILE_SIZE ? 413 : 400 },
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    const allowedMimes = MIME_BY_EXTENSION[ext];
    const mimeType = String(file.type || '').toLowerCase();
    if (!allowedMimes || !allowedMimes.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, JPG, PNG, WebP, CSV or TXT.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!validSignature(buffer, ext)) {
      return NextResponse.json(
        { error: 'The file contents do not match the selected file type' },
        { status: 400 },
      );
    }

    const { text: extractedText, warning } = await extractSafely(buffer, mimeType, file.name);
    const extractedFields = extractStructuredFields(extractedText);
    const applicantFolder = `seller-applications/${sellerApplicantScope(onboarding.phone)}`;
    const storageKey = makeUploadPath(applicantFolder, file.name || `document${ext}`);

    const stored = await uploadPrivateSellerFile(storageKey, buffer, mimeType);
    const document: UploadedApplicationDocument = {
      docType,
      title,
      fileUrl: stored.ref,
      fileName: file.name.slice(0, 255),
      fileSize: file.size,
      mimeType,
      storageKey,
      extractedTextPreview: extractedText.slice(0, 2000),
      extractedFields,
    };
    const uploadProof = await createSellerDocumentProof(onboarding.phone, document);

    return NextResponse.json({
      ok: true,
      document: {
        ...document,
        uploadProof,
        extractionWarning: warning,
      },
    });
  } catch (error) {
    console.error('[seller.application.upload-document] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json(
      { error: 'Unable to upload this document securely right now' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const onboarding = await readSellerOnboardingSession();
  if (!onboarding) {
    return NextResponse.json({ error: 'Seller onboarding session expired' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null) as { uploadProof?: string } | null;
    const document = await verifySellerDocumentProof(String(body?.uploadProof || ''), onboarding.phone);
    if (!document) {
      return NextResponse.json({ error: 'Invalid document reference' }, { status: 400 });
    }

    await deleteFile(privateSellerStorageRef(document.storageKey));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[seller.application.upload-document.delete] failed', {
      message: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ error: 'Unable to remove this document right now' }, { status: 500 });
  }
}
