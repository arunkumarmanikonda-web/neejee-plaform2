// Seller-authenticated upload endpoint (for product images, studio assets, inventory spreadsheets)
import { NextResponse } from 'next/server';
import { getSession,requireRole } from '@/lib/auth';
import { requireSellerContext,canEditInventory } from '@/lib/seller-auth-helpers';
import { uploadPrivateSellerDocument, uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';
import { sellerFileUrl } from '@/lib/seller-private-files';
import { getSellerAgreementUploadGate } from '@/lib/agreement-upload-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const INVENTORY_DOC_TYPES = new Set([
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_DOC_SIZE = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const user=await getSession(),admin=requireRole(user,['ADMIN','SUPER_ADMIN']);
  const gate=admin?null:await requireSellerContext(user);
  if (gate && !gate.ok) return NextResponse.json({error:gate.error},{status:gate.status});
  const seller=gate?.ok?gate.ctx:null;
  if (seller && (!canEditInventory(seller)||seller.seller.kycStatus!=='APPROVED')) {
    return NextResponse.json({error:'Approved inventory access is required.'},{status:403});
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const folder = (form.get('folder') as string | null) || 'seller-products';

    const bulk=folder === 'sellers/bulk-uploads';
    if (!bulk && folder !== 'seller-products') return NextResponse.json({error:'Choose a supported upload destination.'},{status:400});
    if (seller) {
      const agreementGate=await getSellerAgreementUploadGate(seller.seller.id);
      if (agreementGate.blocked) return NextResponse.json({error:agreementGate.message,code:agreementGate.code},{status:423});
    }
    const sellerId=seller?.seller.id||'admin';

    const files: File[] = [];
    form.getAll('files').forEach(f => {
      if (f instanceof File) files.push(f);
    });
    const single = form.get('file');
    if (single instanceof File) files.push(single);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const results: { url: string; path: string }[] = [];

    for (const file of files) {
      const isImage = IMAGE_TYPES.has(file.type);
      const isInventoryDoc = INVENTORY_DOC_TYPES.has(file.type);

      if (bulk ? !isInventoryDoc : !isImage) {
        return NextResponse.json(
          {
            error:
              `${file.name}: only JPG / PNG / WebP / CSV / XLS / XLSX allowed`,
          },
          { status: 400 }
        );
      }

      const maxSize = isInventoryDoc ? MAX_DOC_SIZE : MAX_IMAGE_SIZE;
      if (file.size > maxSize) {
        return NextResponse.json(
          {
            error:
              `${file.name}: file larger than ${isInventoryDoc ? '15 MB' : '4 MB'}`,
          },
          { status: 400 }
        );
      }

      const safeFolder = (bulk?'seller-inventory-files':'seller-products')+'/'+sellerId;
      const path = makeUploadPath(safeFolder, file.name || 'upload.bin');
      const buf = Buffer.from(await file.arrayBuffer());
      const { url } = bulk
        ? {url:sellerFileUrl((await uploadPrivateSellerDocument(path,buf,file.type)).path)}
        : await uploadFile(path, buf, file.type);
      results.push({ url, path });
    }

    return NextResponse.json({ ok: true, files: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}