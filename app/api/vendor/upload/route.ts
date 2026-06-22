// Vendor image upload — mirror of /api/admin/upload but accepts VENDOR / VENDOR_STAFF.
// Used by /vendor/ai-photos for uploading raw phone shots.

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB — phone shots can be heavy

const VENDOR_ROLES = ['VENDOR', 'VENDOR_STAFF'];

export async function POST(request: Request) {
  const user = await getSession();
  if (!user || !VENDOR_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({
      error: 'Storage not configured. Contact admin.',
    }, { status: 500 });
  }

  try {
    const form = await request.formData();
    // Vendors can only upload into ai-photo-studio/vendor-raw/ (locked path)
    const folder = 'ai-photo-studio/vendor-raw';
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large: ${file.name} (max 15MB)` }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const path = makeUploadPath(folder, file.name);
    const { url } = await uploadFile(path, buf, file.type);
    return NextResponse.json({ success: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Upload failed' }, { status: 500 });
  }
}
