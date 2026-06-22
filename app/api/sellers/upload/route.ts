// Public upload endpoint for seller applicants (portfolio images).
// No auth required, but strictly rate-limited by file size + type.
import { NextResponse } from 'next/server';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIZE = 4 * 1024 * 1024;

export async function POST(request: Request) {
  if (!storageConfigured()) {
    return NextResponse.json({ error: 'Image storage not configured' }, { status: 500 });
  }
  try {
    const form = await request.formData();
    const folder = (form.get('folder') as string | null) || 'seller-applications';
    const fileList: File[] = [];
    const fAll = form.getAll('files');
    fAll.forEach(f => { if (f instanceof File) fileList.push(f); });
    const single = form.get('file');
    if (single instanceof File) fileList.push(single);

    if (fileList.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const file = fileList[0];
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG / PNG / WebP allowed' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image larger than 4 MB' }, { status: 400 });
    }

    const safeFolder = folder.replace(/[^a-z0-9\-/]/gi, '_');
    const path = makeUploadPath(safeFolder, file.name || 'sample.jpg');
    const buf = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadFile(path, buf, file.type);

    return NextResponse.json({ ok: true, url, path, files: [{ url, path }] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
