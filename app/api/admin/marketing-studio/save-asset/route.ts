// Save a fal-hosted image to our Supabase storage + Asset row.
// POST body: { url, alt?, caption?, tags? }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { canDraftMarketing } from '@/lib/marketing/roles';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getSession();
  if (!canDraftMarketing(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!storageConfigured()) {
    return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
  }

  try {
    const { url, alt, caption, tags } = await req.json();
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

    // Fetch the remote image
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch source image: ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const filename = `studio-${Date.now()}.${ext}`;

    const path = makeUploadPath('marketing-studio', filename);
    const { url: storedUrl } = await uploadFile(path, buf, contentType);

    const asset = await prisma.asset.create({
      data: {
        url: storedUrl,
        filename,
        folder: 'marketing-studio',
        size: buf.length,
        contentType,
        alt: alt || null,
        caption: caption || null,
        tags: Array.isArray(tags) ? tags : [],
        uploadedBy: session!.id,
      },
    });

    return NextResponse.json({ asset });
  } catch (err: any) {
    console.error('[marketing-studio.save-asset]', err);
    return NextResponse.json({ error: err?.message || 'Save failed' }, { status: 500 });
  }
}
