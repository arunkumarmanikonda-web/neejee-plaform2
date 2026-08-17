// Issues a signed URL so the browser can upload a large customer image
// directly into the private Supabase AI bucket, bypassing Vercel body limits.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  createSignedUploadUrl,
  makeUploadPath,
  PRIVATE_AI_STORAGE_BUCKET,
  storageConfigured,
} from '@/lib/storage';
import { createPrivateAiMediaUrl } from '@/lib/ai/private-media';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);
const MAX_BYTES = 15 * 1024 * 1024;

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
    return NextResponse.json({ error: 'Image storage not configured' }, { status: 500 });
  }

  try {
    const { filename, contentType, size, folder } = await request.json();
    if (!filename) return NextResponse.json({ error: 'Filename required' }, { status: 400 });
    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Only JPG / PNG / WebP / HEIC images are allowed' }, { status: 400 });
    }
    if (!Number.isFinite(Number(size)) || Number(size) <= 0 || Number(size) > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be between 1 byte and 15 MB' }, { status: 400 });
    }

    const baseFolder = safeAiFolder(folder);
    const userScoped = `${baseFolder}/${session.id}`;
    const path = makeUploadPath(userScoped, String(filename));

    const signed = await createSignedUploadUrl(path, PRIVATE_AI_STORAGE_BUCKET);
    const mediaUrl = createPrivateAiMediaUrl(new URL(request.url).origin, path);
    return NextResponse.json({
      signedUrl: signed.signedUrl,
      token: signed.token,
      path: signed.path,
      // Kept for client compatibility; this is now a short-lived signed
      // NEEJEE proxy URL, not a public Supabase object URL.
      publicUrl: mediaUrl,
    });
  } catch (e: any) {
    console.error('[ai.sign-upload] failed', { userId: session.id, message: e?.message });
    return NextResponse.json({ error: 'Unable to prepare this upload right now' }, { status: 500 });
  }
}
