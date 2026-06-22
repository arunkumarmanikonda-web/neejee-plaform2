// POST /api/vendor/purchase-orders/[id]/invoice
// Multipart: file (PDF or image), invoiceNumber? (optional)
// Uploads the invoice to Supabase Storage and stores the URL on the PO,
// plus creates a VendorDocument row with docType=INVOICE for audit trail.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';
import { resolveVendorForSession } from '@/lib/vendor-auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_SIZE = 15 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const v = await resolveVendorForSession(session);
  if (!v) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!storageConfigured()) return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });

  // Check this PO belongs to the vendor
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, vendorId: v.vendorId, status: { notIn: ['DRAFT'] } },
  });
  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

  try {
    const form = await request.formData();
    const file = form.get('file') as File | null;
    const invoiceNumber = (form.get('invoiceNumber') as string | null) || null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}. Use JPG, PNG, WebP, or PDF.` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 15 MB)' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const path = makeUploadPath(`vendor-docs/${v.vendorId}/invoices`, file.name);
    const { url } = await uploadFile(path, buf, file.type);

    // Update PO + create VendorDocument record
    const [updatedPo, doc] = await prisma.$transaction([
      prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          vendorInvoiceUrl: url,
          ...(invoiceNumber ? { vendorInvoiceNumber: invoiceNumber } : {}),
        },
      }),
      prisma.vendorDocument.create({
        data: {
          vendorId: v.vendorId,
          docType: 'INVOICE',
          title: `Invoice for ${po.poNumber}`,
          fileName: file.name,
          fileUrl: url,
          fileSize: file.size,
          mimeType: file.type,
          status: 'SUBMITTED',
          uploadedByUserId: session!.id,
          uploadedOnBehalf: false,
        },
      }),
    ]);

    await prisma.vendorAuditLog.create({
      data: {
        vendorId: v.vendorId,
        actorUserId: session!.id,
        actorRole: session!.role,
        action: 'INVOICE_UPLOADED',
        details: { poId: po.id, poNumber: po.poNumber, documentId: doc.id },
      },
    });

    return NextResponse.json({ purchaseOrder: updatedPo, document: doc });
  } catch (e: any) {
    console.error('[vendor invoice upload]', e);
    return NextResponse.json({ error: e?.message || 'Upload failed' }, { status: 500 });
  }
}
