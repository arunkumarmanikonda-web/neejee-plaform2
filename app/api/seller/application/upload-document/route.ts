import path from 'path';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  extractStructuredFields,
  extractTextFromDocument,
  type ApplicationDocType,
} from '@/lib/seller-onboarding/document-intel';
import { uploadPrivateSellerDocument } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const STORAGE_PREFIX = 'seller-applications/intake/';

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
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  '.txt': ['text/plain'],
};

function validateFile(file: File): { ext: string; mimeType: string } | null {
  const ext = path.extname(file.name || '').toLowerCase();
  const allowedMimes = MIME_BY_EXTENSION[ext];
  if (!allowedMimes) return null;

  const suppliedMime = String(file.type || '').trim().toLowerCase();
  if (suppliedMime && !allowedMimes.includes(suppliedMime)) return null;

  return {
    ext,
    mimeType: suppliedMime || allowedMimes[0],
  };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const docType = String(form.get('docType') || '').trim() as ApplicationDocType;
    const title = String(form.get('title') || '').trim() || null;
    const file = form.get('file');

    if (!ALLOWED_DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'The selected document is empty' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Document exceeds the 8 MB upload limit' }, { status: 413 });
    }

    const validatedFile = validateFile(file);
    if (!validatedFile) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract and validate document intelligence before persisting the object so
    // malformed files do not leave avoidable orphaned KYC objects behind.
    const extractedText = await extractTextFromDocument({
      buffer,
      mimeType: validatedFile.mimeType,
      fileName: file.name,
    });
    const extractedFields = extractStructuredFields(extractedText);

    const storageKey = `${STORAGE_PREFIX}${Date.now()}-${randomUUID()}${validatedFile.ext}`;
    const stored = await uploadPrivateSellerDocument(
      storageKey,
      buffer,
      validatedFile.mimeType,
    );

    return NextResponse.json({
      ok: true,
      document: {
        docType,
        title,
        fileUrl: stored.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: validatedFile.mimeType,
        storageKey: stored.path,
        extractedTextPreview: extractedText.slice(0, 2000),
        extractedFields,
      },
    });
  } catch (e: any) {
    console.error('[seller-application-upload]', e);
    return NextResponse.json(
      { error: 'Failed to upload document. Please try again.' },
      { status: 500 },
    );
  }
}
