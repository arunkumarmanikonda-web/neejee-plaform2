// Seller documents API.
// GET    /api/seller/documents      — list all documents for current seller
// POST   /api/seller/documents      — upload metadata for a new document
//   body: { docType, title?, fileName, fileUrl, fileSize, mimeType }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { canEditFinance,requireSellerContext } from '@/lib/seller-auth-helpers';
import { randomUUID } from 'node:crypto';
import { sellerDocumentType,sellerFileUrl } from '@/lib/seller-private-files';
import { privateSellerDocumentPathFromUrl,uploadPrivateSellerDocument,deletePrivateSellerFile } from '@/lib/storage';
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

  if (!canEditFinance(gate.ctx)) return NextResponse.json({error:'Document access requires finance permissions.'},{status:403});
  try {
    const docs = await prisma.sellerDocument.findMany({
      where: { sellerId: gate.ctx.seller.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ documents: docs.map(doc=>{
      const path=privateSellerDocumentPathFromUrl(doc.fileUrl);
      return path?{...doc,fileUrl:sellerFileUrl(path)}:doc;
    }) });
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

  if (!canEditFinance(ctx)) return NextResponse.json({error:'Document access requires finance permissions.'},{status:403});
  let uploadedPath: string|undefined;
  try {
    const multipart=req.headers.get('content-type')?.startsWith('multipart/form-data');
    const form=multipart?await req.formData():null;
    const metadata=form?null:await req.json();
    const docType=String(form?.get('docType')??metadata?.docType??'');
    if (!ALLOWED_DOC_TYPES.has(docType)) return NextResponse.json({error:'Choose a document type.'},{status:400});
    const title=String(form?.get('title')??metadata?.title??'').slice(0,240);
    let fileName:string,fileUrl:string,fileSize:number,mimeType:string;
    if (form) {
      const file=form.get('file');
      if (!(file instanceof File)||!file.size||file.size>15*1024*1024) return NextResponse.json({error:'Choose a file up to 15 MB.'},{status:400});
      const bytes=Buffer.from(await file.arrayBuffer()),type=sellerDocumentType(bytes);
      if (!type||type!==file.type) return NextResponse.json({error:'Choose a JPG, PNG, WebP or PDF file.'},{status:400});
      const path='seller-documents/'+ctx.seller.id+'/'+randomUUID();
      const result=await uploadPrivateSellerDocument(path,bytes,type);
      uploadedPath=path;fileUrl=result.url;fileName=file.name.slice(0,200);fileSize=file.size;mimeType=type;
    } else {
      // Keep recognised, previously registered documents readable through the legacy JSON client.
      const prior=await prisma.sellerDocument.findFirst({where:{sellerId:ctx.seller.id,fileUrl:String(metadata?.fileUrl||'')},
        select:{fileName:true,fileUrl:true,fileSize:true,mimeType:true}});
      if (!prior) return NextResponse.json({error:'Upload the document file to register it.'},{status:400});
      fileName=prior.fileName;fileUrl=prior.fileUrl;fileSize=prior.fileSize||0;mimeType=prior.mimeType||'application/octet-stream';
    }

    const doc = await prisma.sellerDocument.create({
      data: {
        sellerId: ctx.seller.id,
        docType: docType as any,
        title: title || null,
        fileName: String(fileName),
        fileUrl: String(fileUrl),
        fileSize: fileSize,
        mimeType: String(mimeType || 'application/octet-stream'),
        status: 'SUBMITTED',
        uploadedByUserId: session!.id,
        uploadedOnBehalf: false,
      },
    });

    uploadedPath=undefined;
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
    if (uploadedPath) await deletePrivateSellerFile(uploadedPath).catch(()=>console.warn('[seller-documents] private cleanup pending'));
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
