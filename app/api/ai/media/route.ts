import { NextResponse } from 'next/server';
import { verifyPrivateAiMediaRequest } from '@/lib/ai/private-media';
import { fetchPrivateAiObject } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verified = verifyPrivateAiMediaRequest(url);
  if (!verified.ok) {
    return NextResponse.json({ error: 'Media link is invalid or expired' }, { status: 403 });
  }

  try {
    const upstream = await fetchPrivateAiObject(verified.path);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: upstream.status === 404 ? 'Media not found' : 'Media unavailable' },
        { status: upstream.status === 404 ? 404 : 502 },
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    const length = upstream.headers.get('content-length');
    if (length) headers.set('Content-Length', length);
    headers.set('Cache-Control', 'private, no-store, max-age=0');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Disposition', 'inline');

    return new Response(upstream.body, { status: 200, headers });
  } catch (error: any) {
    console.error('[ai.media] private media fetch failed', { message: error?.message });
    return NextResponse.json({ error: 'Media unavailable' }, { status: 502 });
  }
}
