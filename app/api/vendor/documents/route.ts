// GET  /api/vendor/documents       — list this vendor's documents
// POST /api/vendor/documents       — upload a document (multipart form-data:
//                                    file, docType, title?)
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic',
  'application/pdf',
]);
const VALID_DOC_TYPES = [
  'PAN_CARD','GST_CERTIFICATE','MSME_CERTIFICATE','CANCELLED_CHEQUE',
  'BANK_STATEMENT','ADDRESS_PROOF','AADHAAR_SIGNATORY','SIGNATORY_PHOTO',
  'VENDOR_AGREEMENT','INVOICE','GRN_DISPUTE','OTHER',
];

async function vendorGate() {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') return { error: 'Unauthorized', status: 401 };
  const vendor = await prisma.vendor.findUnique({ where: { userId: session.id } });
  if (!vendor) return { error: 'No vendor profile', status: 404 };
  return { session, vendor };
}

export async function GET() {
  const g = await vendorGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  try {
    const docs = await prisma.vendorDocument.findMany({
      where: { vendorId: g.vendor.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return NextResponse.json({ documents: docs });
  } catch (e: any) {
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}

export async function POST(request: Request) {
  const g = await vendorGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  if (!storageConfigured()) {
    return NextResponse.json({
      error: 'File storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    }, { status: 500 });
  }
  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const docType = String(form.get('docType') || '').toUpperCase();
    const title = (form.get('title') as string | null) || null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (!VALID_DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: 'Invalid docType' }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}. Use JPG, PNG, WebP, or PDF.` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large (max 15 MB)` }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const path = makeUploadPath(`vendor-docs/${g.vendor.id}/${docType.toLowerCase()}`, file.name);
    const { url } = await uploadFile(path, buf, file.type);

    const doc = await prisma.vendorDocument.create({
      data: {
        vendorId: g.vendor.id,
        docType: docType as any,
        title,
        fileName: file.name,
        fileUrl: url,
        fileSize: file.size,
        mimeType: file.type,
        status: 'SUBMITTED',
        uploadedByUserId: g.session.id,
        uploadedOnBehalf: false,
      },
    });

    await prisma.vendorAuditLog.create({
      data: {
        vendorId: g.vendor.id,
        actorUserId: g.session.id,
        actorRole: 'VENDOR',
        action: 'DOC_UPLOADED',
        details: { documentId: doc.id, docType, fileName: file.name },
      },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (e: any) {
    console.error('[vendor/documents POST]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}
