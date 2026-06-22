// v23.38 — Finance document upload (bills, receipts, payslips, statements)
// Accepts images AND PDFs.
// POST multipart/form-data with field 'file' or 'files'.

import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel',                                          // xls
  'text/csv',
  'application/csv',
  'text/plain',                                                        // some banks export .txt
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword',                                                // doc
]);

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB for finance docs

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'FINANCE_OPERATOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({
      error: 'Storage not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel env vars.',
    }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const folder = (form.get('folder') as string | null) || 'finance';
    const fileList: File[] = [];

    for (const key of ['file', 'files', 'files[]']) {
      const entries = form.getAll(key);
      for (const e of entries) {
        if (e instanceof File) fileList.push(e);
      }
    }
    if (fileList.length === 0) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const uploaded: { url: string; path: string; name: string; size: number; type: string }[] = [];
    for (const file of fileList) {
      const fileType = file.type || 'application/octet-stream';
      if (!ALLOWED.has(fileType)) {
        return NextResponse.json({
          error: `File type not allowed: ${fileType} (allowed: images, PDF, Excel, CSV, Word)`,
        }, { status: 400 });
      }
      if (file.size > MAX_SIZE) {
        return NextResponse.json({
          error: `File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB, max 20MB)`,
        }, { status: 400 });
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const path = makeUploadPath(folder, file.name);
      const { url } = await uploadFile(path, buf, fileType);
      uploaded.push({ url, path, name: file.name, size: file.size, type: fileType });
    }

    return NextResponse.json({ success: true, files: uploaded });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}
