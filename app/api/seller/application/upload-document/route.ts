import path from 'path';
import { createHash, randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import {
  extractStructuredFields,
  extractTextFromDocument,
  type ApplicationDocType,
} from '@/lib/seller-onboarding/document-intel';
import { prisma } from '@/lib/prisma';
import { privateSellerDocumentUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const STORAGE_PREFIX = 'seller-applications/intake/';
const SUPABASE_PROJECT_URL = 'https://xjqehwvxscoktfecbwse.supabase.co';
const SELLER_UPLOAD_FUNCTION_URL = `${SUPABASE_PROJECT_URL}/functions/v1/seller-private-upload`;

// The anon key is a publishable project credential. It is intentionally safe to
// embed in server/client applications; the Edge Function still requires a short-
// lived, one-time database-backed upload ticket before it will write any object.
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqcWVod3Z4c2Nva3RmZWNid3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDIzODMsImV4cCI6MjA5NTI3ODM4M30.FYrQlJ2GvZ7f6svN0nqdmkhy6ETtR_L6MlBAcmc8Wc8';

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

async function uploadPrivateSellerDocumentViaEdge(input: {
  storageKey: string;
  file: File;
  mimeType: string;
}): Promise<{ path: string; url: string }> {
  const ticket = `${randomUUID()}${randomUUID()}`;
  const tokenHash = createHash('sha256').update(ticket).digest('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.$executeRawUnsafe(
    `INSERT INTO public._seller_upload_ticket
      (token_hash, object_path, mime_type, file_size, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    tokenHash,
    input.storageKey,
    input.mimeType,
    input.file.size,
    expiresAt,
  );

  try {
    const edgeForm = new FormData();
    edgeForm.append('ticket', ticket);
    edgeForm.append('objectPath', input.storageKey);
    edgeForm.append('mimeType', input.mimeType);
    edgeForm.append('file', input.file);

    const response = await fetch(SELLER_UPLOAD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: edgeForm,
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok || payload?.path !== input.storageKey) {
      throw new Error(payload?.error || `Private seller storage upload failed (${response.status})`);
    }

    return {
      path: input.storageKey,
      url: privateSellerDocumentUrl(input.storageKey),
    };
  } finally {
    // Tickets are one-time and short-lived. Remove the row after every completed
    // request path (success or failure) so intake authorization cannot accumulate.
    await prisma.$executeRawUnsafe(
      'DELETE FROM public._seller_upload_ticket WHERE token_hash = $1',
      tokenHash,
    ).catch(() => undefined);
  }
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
    const stored = await uploadPrivateSellerDocumentViaEdge({
      storageKey,
      file,
      mimeType: validatedFile.mimeType,
    });

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
