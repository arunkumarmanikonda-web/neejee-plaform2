// Customer-facing image upload for AI Mirror / AI Space.
// Small files pass through Vercel; large files use /api/ai/sign-upload.
// Customer media is stored in the private AI bucket and exposed only through
// a short-lived signed NEEJEE media URL.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { uploadPrivateAiFile, makeUploadPath, storageConfigured } from '@/lib/storage';
import { createPrivateAiMediaUrl } from '@/lib/ai/private-media';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const MAX_SIZE = 4 * 1024 * 1024;

function safeAiFolder(value: unknown): string {
  const normalized = String(value || 'ai-user-uploads')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 48);
  return normalized.startsWith('ai-') ? normalized : 'ai-user-uploads';
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Please sign in to use AI surfaces' }, { status: 401 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: 'Image storage not configured. Please contact NEEJEE.' }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const folder = safeAiFolder(form.get('folder'));
    const file = form.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: 'Only JPG / PNG / WebP / HEIC images allowed' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image larger than 4 MB. Please retry the direct upload.' }, { status: 413 });
    }

    const userScopedFolder = `${folder}/${session.id}`;
    const path = makeUploadPath(userScopedFolder, file.name || 'upload.jpg');
    const buf = Buffer.from(await file.arrayBuffer());

    await uploadPrivateAiFile(path, buf, file.type);
    const url = createPrivateAiMediaUrl(new URL(request.url).origin, path);
    return NextResponse.json({ ok: true, url, path });
  } catch (e: any) {
    console.error('[ai.upload] failed', { userId: session.id, message: e?.message });
    return NextResponse.json({ error: 'Unable to upload this image right now' }, { status: 500 });
  }
}
