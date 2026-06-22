// Customer-facing image upload for AI Mirror / AI Space.
// Lighter than the admin upload (single file, smaller max size, customer auth).
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_SIZE = 4 * 1024 * 1024; // 4 MB — anything bigger should use /api/ai/sign-upload instead

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Please sign in to use AI surfaces' }, { status: 401 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({
      error: 'Image storage not configured. Please contact NEEJEE.',
    }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const folder = (form.get('folder') as string | null) || 'ai-user-uploads';
    const file = form.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG / PNG / WebP / HEIC images allowed' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image larger than 8 MB' }, { status: 400 });
    }

    // Path: ai-user-uploads/<userId>/<timestamp>-<filename>
    const userScopedFolder = `${folder}/${session.id}`;
    const path = makeUploadPath(userScopedFolder, file.name || 'upload.jpg');
    const buf = Buffer.from(await file.arrayBuffer());

    const { url } = await uploadFile(path, buf, file.type);
    return NextResponse.json({ ok: true, url, path });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
