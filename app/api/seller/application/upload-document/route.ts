import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  extractStructuredFields,
  extractTextFromDocument,
  type ApplicationDocType,
} from '@/lib/seller-onboarding/document-intel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_DOC_TYPES: ApplicationDocType[] = [
  'PAN_CARD',
  'GST_CERTIFICATE',
  'MSME_CERTIFICATE',
  'CANCELLED_CHEQUE',
  'BANK_STATEMENT',
  'CERTIFICATION',
  'OTHER',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.csv', '.txt'];
const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'image/',
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
];

function isAllowedFile(fileName: string, mimeType: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext)
    || ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
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

    if (!isAllowedFile(file.name, file.type || '')) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name).toLowerCase() || '.bin';
    const storageKey = `${Date.now()}-${randomUUID()}${ext}`;
    const tmpDir = path.join(process.cwd(), 'public', 'uploads', 'seller-docs', 'tmp');

    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, storageKey), buffer);

    const extractedText = await extractTextFromDocument({
      buffer,
      mimeType: file.type || 'application/octet-stream',
      fileName: file.name,
    });

    const extractedFields = extractStructuredFields(extractedText);

    return NextResponse.json({
      ok: true,
      document: {
        docType,
        title,
        fileUrl: `/uploads/seller-docs/tmp/${storageKey}`,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        storageKey,
        extractedTextPreview: extractedText.slice(0, 2000),
        extractedFields,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to upload document' },
      { status: 500 },
    );
  }
}