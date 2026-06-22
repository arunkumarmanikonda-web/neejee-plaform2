// GET  /api/admin/vendors/[id]/documents — list docs for a vendor
// POST /api/admin/vendors/[id]/documents — admin uploads a doc on vendor's behalf
//        (when vendor sends docs via WhatsApp/email)
// PATCH /api/admin/vendors/[id]/documents — bulk-approve a doc with body { docId, action: APPROVE|REJECT, note? }
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';
import { notify } from '@/lib/notifications';
import { DOC_TYPE_LABELS } from '@/lib/vendor-profile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
]);
const VALID_DOC_TYPES = [
  'PAN_CARD','GST_CERTIFICATE','MSME_CERTIFICATE','CANCELLED_CHEQUE',
  'BANK_STATEMENT','ADDRESS_PROOF','AADHAAR_SIGNATORY','SIGNATORY_PHOTO',
  'VENDOR_AGREEMENT','INVOICE','GRN_DISPUTE','OTHER',
];

async function adminGate(write = false) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  const reads = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
  const writes = ['ADMIN', 'SUPER_ADMIN'];
  if (!(write ? writes : reads).includes(session.role)) {
    return { error: 'Forbidden', status: 403 };
  }
  return { session };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await adminGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  try {
    const docs = await prisma.vendorDocument.findMany({
      where: { vendorId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { changeRequest: { select: { id: true, status: true } } },
    });
    return NextResponse.json({ documents: docs });
  } catch (e: any) {
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const g = await adminGate(true);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  if (!storageConfigured()) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });

  const vendor = await prisma.vendor.findUnique({ where: { id: params.id } });
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const docType = String(form.get('docType') || '').toUpperCase();
    const title = (form.get('title') as string | null) || null;
    const autoApprove = String(form.get('autoApprove') || '') === 'true';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (!VALID_DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: 'Invalid docType' }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const path = makeUploadPath(`vendor-docs/${vendor.id}/${docType.toLowerCase()}`, file.name);
    const { url } = await uploadFile(path, buf, file.type);

    const doc = await prisma.vendorDocument.create({
      data: {
        vendorId: vendor.id,
        docType: docType as any,
        title,
        fileName: file.name,
        fileUrl: url,
        fileSize: file.size,
        mimeType: file.type,
        status: autoApprove ? 'APPROVED' : 'SUBMITTED',
        uploadedByUserId: g.session.id,
        uploadedOnBehalf: true,
        ...(autoApprove ? { reviewedByUserId: g.session.id, reviewedAt: new Date() } : {}),
      },
    });
    await prisma.vendorAuditLog.create({
      data: {
        vendorId: vendor.id,
        actorUserId: g.session.id,
        actorRole: g.session.role,
        action: autoApprove ? 'DOC_UPLOADED_AND_APPROVED_ON_BEHALF' : 'DOC_UPLOADED_ON_BEHALF',
        details: { documentId: doc.id, docType, fileName: file.name },
      },
    });
    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (e: any) {
    console.error('[admin vendor doc upload]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const g = await adminGate(true);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: any = {};
  try { body = await request.json(); } catch {}
  const docId = body?.docId as string;
  const action = String(body?.action || '').toUpperCase();
  const note = body?.note ? String(body.note).slice(0, 1000) : null;
  if (!docId || !['APPROVE', 'REJECT'].includes(action)) {
    return NextResponse.json({ error: 'Provide docId and action (APPROVE|REJECT)' }, { status: 400 });
  }
  try {
    const doc = await prisma.vendorDocument.findFirst({ where: { id: docId, vendorId: params.id } });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    const updated = await prisma.vendorDocument.update({
      where: { id: doc.id },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        reviewedByUserId: g.session.id,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
    await prisma.vendorAuditLog.create({
      data: {
        vendorId: params.id,
        actorUserId: g.session.id,
        actorRole: g.session.role,
        action: action === 'APPROVE' ? 'DOC_APPROVED' : 'DOC_REJECTED',
        details: { documentId: doc.id, docType: doc.docType, note },
      },
    });
    // Notify vendor (owner)
    const vendor = await prisma.vendor.findUnique({ where: { id: params.id }, select: { userId: true } });
    if (vendor?.userId) {
      notify({
        event: action === 'APPROVE' ? 'DOC_APPROVED' : 'DOC_REJECTED',
        userId: vendor.userId,
        data: { docType: doc.docType, docTypeLabel: DOC_TYPE_LABELS[doc.docType] || doc.docType, note },
        context: { type: 'VENDOR_DOCUMENT', id: doc.id },
      }).catch(e => console.warn('[notify DOC]', e));
    }
    return NextResponse.json({ document: updated });
  } catch (e: any) {
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}
