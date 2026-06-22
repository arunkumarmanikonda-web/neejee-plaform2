// Seller-authenticated upload endpoint (for product images, studio assets)
import { NextResponse } from 'next/server';
import { requireApprovedSeller } from '@/lib/seller-context';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const ctx = await requireApprovedSeller();
  if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  if (!storageConfigured()) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 });
  }
  try {
    const form = await request.formData();
    const folder = (form.get('folder') as string | null) || 'seller-products';
    const sellerId = ctx.seller?.id || 'admin';

    const files: File[] = [];
    form.getAll('files').forEach(f => { if (f instanceof File) files.push(f); });
    const single = form.get('file');
    if (single instanceof File) files.push(single);

    if (files.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const results: { url: string; path: string }[] = [];
    for (const file of files) {
      if (!ALLOWED.has(file.type)) {
        return NextResponse.json({ error: `${file.name}: only JPG / PNG / WebP allowed` }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `${file.name}: image larger than 4 MB` }, { status: 400 });
      }
      const safeFolder = `${folder.replace(/[^a-z0-9\-/]/gi, '_')}/${sellerId}`;
      const path = makeUploadPath(safeFolder, file.name || 'image.jpg');
      const buf = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadFile(path, buf, file.type);
      results.push({ url, path });
    }

    return NextResponse.json({ ok: true, files: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
