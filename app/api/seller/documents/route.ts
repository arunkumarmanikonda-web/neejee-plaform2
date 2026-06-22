// Seller documents API.
// GET    /api/seller/documents      — list all documents for current seller
// POST   /api/seller/documents      — upload metadata for a new document
//   body: { docType, title?, fileName, fileUrl, fileSize, mimeType }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_DOC_TYPES = new Set([
  'PAN_CARD', 'GST_CERTIFICATE', 'MSME_CERTIFICATE', 'CANCELLED_CHEQUE',
  'BANK_STATEMENT', 'ADDRESS_PROOF', 'AADHAAR_SIGNATORY', 'SIGNATORY_PHOTO',
  'SELLER_AGREEMENT', 'PRODUCT_CATALOG', 'CERTIFICATION', 'OTHER',
]);

export async function GET() {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const docs = await prisma.sellerDocument.findMany({
      where: { sellerId: gate.ctx.seller.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ documents: docs });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { ctx } = gate;

  try {
    const body = await req.json();
    const { docType, title, fileName, fileUrl, fileSize, mimeType } = body;
    if (!docType || !fileUrl || !fileName) {
      return NextResponse.json({ error: 'docType, fileName, and fileUrl are required' }, { status: 400 });
    }
    if (!ALLOWED_DOC_TYPES.has(docType)) {
      return NextResponse.json({ error: `Invalid docType: ${docType}` }, { status: 400 });
    }

    const doc = await prisma.sellerDocument.create({
      data: {
        sellerId: ctx.seller.id,
        docType: docType as any,
        title: title || null,
        fileName: String(fileName),
        fileUrl: String(fileUrl),
        fileSize: parseInt(fileSize) || 0,
        mimeType: String(mimeType || 'application/octet-stream'),
        status: 'SUBMITTED',
        uploadedByUserId: session!.id,
        uploadedOnBehalf: false,
      },
    });

    // Audit log
    await prisma.sellerAuditLog.create({
      data: {
        sellerId: ctx.seller.id,
        actorUserId: session!.id,
        actorRole: ctx.actorRole,
        action: 'DOCUMENT_UPLOADED',
        details: { docType, fileName, docId: doc.id } as any,
      },
    }).catch(() => {});

    // Notify admins
    try {
      const { notify } = await import('@/lib/notifications');
      notify({
        event: 'SELLER_DOC_UPLOADED' as any,
        toAdmins: true,
        data: {
          sellerName: ctx.seller.businessName,
          docType,
          fileName,
        },
        context: { type: 'SELLER_DOCUMENT', id: doc.id },
      }).catch(() => {});
    } catch { /* */ }

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
