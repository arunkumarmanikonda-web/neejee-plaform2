// Admin image upload endpoint — uploads to Supabase Storage
// POST multipart/form-data with field 'file' (single) or 'files' (multiple)
// Optional 'folder' field to namespace (default 'products')
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB — modern phone JPEGs can exceed 10 MB

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({
      error: 'Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env vars.',
    }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const folder = (form.get('folder') as string | null) || 'products';
    const fileList: File[] = [];

    // Accept both 'file' (single) and 'files' (multiple) and 'files[]'
    for (const key of ['file', 'files', 'files[]']) {
      const entries = form.getAll(key);
      for (const e of entries) {
        if (e instanceof File) fileList.push(e);
      }
    }
    if (fileList.length === 0) {
      return NextResponse.json({ error: 'No file uploaded. Use field name "file" or "files".' }, { status: 400 });
    }

    const uploaded: { url: string; path: string; name: string; size: number }[] = [];
    for (const file of fileList) {
      if (!ALLOWED.has(file.type)) {
        return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({ error: `File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB, max 15MB)` }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const path = makeUploadPath(folder, file.name);
      const { url } = await uploadFile(path, buf, file.type);
      uploaded.push({ url, path, name: file.name, size: file.size });
    }

    return NextResponse.json({ success: true, files: uploaded });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}
