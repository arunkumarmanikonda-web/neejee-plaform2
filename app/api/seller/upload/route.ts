// Seller-authenticated upload endpoint (for product images, studio assets, inventory spreadsheets)
import { NextResponse } from 'next/server';
import { requireApprovedSeller } from '@/lib/seller-context';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';
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

const ENFORCED_FOLDERS = [
  'seller-products',
  'seller-inventory',
  'seller-inventory-files',
  'inventory-submissions',
];

export async function POST(request: Request) {
  const ctx = await requireApprovedSeller();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  if (!storageConfigured()) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const folder = (form.get('folder') as string | null) || 'seller-products';

    if (!ctx.isAdmin && ctx.seller) {
      const normalizedFolder = String(folder || '').toLowerCase();
      const shouldEnforceAgreement = ENFORCED_FOLDERS.some(prefix =>
        normalizedFolder.startsWith(prefix)
      );

      if (shouldEnforceAgreement) {
        const agreementGate = await getSellerAgreementUploadGate(ctx.seller.id);
        if (agreementGate.blocked) {
          return NextResponse.json(
            { error: agreementGate.message, code: agreementGate.code, agreementGate },
            { status: 423 }
          );
        }
      }
    }

    const sellerId = ctx.seller?.id || 'admin';

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

      if (!isImage && !isInventoryDoc) {
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

      const safeFolder = `${folder.replace(/[^a-z0-9\-/]/gi, '_')}/${sellerId}`;
      const path = makeUploadPath(safeFolder, file.name || 'upload.bin');
      const buf = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadFile(path, buf, file.type);
      results.push({ url, path });
    }

    return NextResponse.json({ ok: true, files: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}