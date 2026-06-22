// Issues a signed URL so the browser can upload a large image directly to Supabase Storage,
// bypassing Vercel's 4.5 MB serverless body limit.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createSignedUploadUrl, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]);
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB ceiling

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
    if (size && size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 15 MB or smaller' }, { status: 400 });
    }

    const baseFolder = String(folder || 'ai-user-uploads').replace(/[^a-z0-9\-/]/gi, '_');
    const userScoped = `${baseFolder}/${session.id}`;
    const path = makeUploadPath(userScoped, filename);

    const signed = await createSignedUploadUrl(path);
    return NextResponse.json({
      signedUrl: signed.signedUrl,
      token: signed.token,
      path: signed.path,
      publicUrl: signed.publicUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
