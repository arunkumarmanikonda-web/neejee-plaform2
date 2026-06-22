// Poll fal.ai for the current status of a try-on job.
// Uses fal's actual status_url and response_url returned at submit time —
// no URL reconstruction, so we can never get out of sync with fal's routing.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const FAL_BASE = 'https://queue.fal.run';

/** Download a fal CDN image and re-upload to our Supabase bucket. */
async function rehostImage(falUrl: string, userId: string): Promise<string> {
  if (!storageConfigured()) {
    return falUrl;
  }
  try {
    const res = await fetch(falUrl);
    if (!res.ok) throw new Error(`fal download failed: ${res.status}`);
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    const path = makeUploadPath(`ai-mirror/${userId}`, `mirror-${Date.now()}.${ext}`);
    const { url } = await uploadFile(path, buf, contentType);
    return url;
  } catch (e: any) {
    console.warn('[mirror/status] re-host failed, using fal URL directly:', e?.message);
    return falUrl;
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const requestId = url.searchParams.get('id');
  const previewId = url.searchParams.get('previewId');
  const endpoint = url.searchParams.get('endpoint');
  // Prefer the actual URLs fal returned at submit time
  const passedStatusUrl = url.searchParams.get('statusUrl');
  const passedResponseUrl = url.searchParams.get('responseUrl');

  if (!requestId || !previewId || !endpoint) {
    return NextResponse.json({ error: 'id, previewId and endpoint required' }, { status: 400 });
  }

  // Verify the preview belongs to this user
  const preview = await prisma.aiPreview.findUnique({
    where: { id: previewId },
    select: { id: true, userId: true, outputImage: true },
  });
  if (!preview || preview.userId !== session.id) {
    return NextResponse.json({ error: 'Preview not found' }, { status: 404 });
  }

  // Short-circuit if we already have the result
  if (preview.outputImage) {
    return NextResponse.json({ done: true, outputUrl: preview.outputImage });
  }

  const key = process.env.FAL_KEY;
  if (!key) return NextResponse.json({ error: 'FAL_KEY not set' }, { status: 500 });

  // Use fal's actual URL if passed, else construct as fallback
  const statusUrl = passedStatusUrl || `${FAL_BASE}/${endpoint}/requests/${requestId}/status`;

  try {
    const sRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: 'no-store',
    });
    const sJson = await sRes.json().catch(() => ({}));

    // VERBOSE LOGGING — visible in Vercel function logs
    console.log('[mirror/status] poll result:', {
      requestId: requestId.slice(0, 12) + '...',
      statusUrl,
      httpStatus: sRes.status,
      falStatus: sJson?.status,
      queuePosition: sJson?.queue_position,
      logsCount: sJson?.logs?.length,
      lastLog: sJson?.logs?.slice(-1)?.[0]?.message,
      hasResponseUrl: !!sJson?.response_url,
    });

    if (!sRes.ok) {
      return NextResponse.json({
        error: sJson?.error || sJson?.detail || `fal status check failed (${sRes.status})`,
        debug: { statusUrl, httpStatus: sRes.status, body: sJson },
      }, { status: 500 });
    }

    const status = sJson.status as string | undefined;

    if (status === 'COMPLETED') {
      // Always prefer fal's response_url over our constructed one
      const resultUrl = sJson.response_url || passedResponseUrl || `${FAL_BASE}/${endpoint}/requests/${requestId}`;
      console.log('[mirror/status] COMPLETED, fetching result from:', resultUrl);

      const rRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${key}` },
        cache: 'no-store',
      });
      const rJson = await rRes.json().catch(() => ({}));

      console.log('[mirror/status] result response:', {
        httpStatus: rRes.status,
        keys: Object.keys(rJson || {}),
        imagesCount: rJson?.images?.length,
        firstImageUrl: rJson?.images?.[0]?.url?.slice(0, 80),
      });

      const outUrl: string | undefined =
        rJson?.images?.[0]?.url ||
        rJson?.image?.url ||
        rJson?.output?.images?.[0]?.url ||
        rJson?.output?.[0]?.url ||
        rJson?.output_url;

      if (!outUrl) {
        return NextResponse.json({
          error: 'fal completed but no image URL in response',
          debug: { resultUrl, httpStatus: rRes.status, responseKeys: Object.keys(rJson || {}), sample: JSON.stringify(rJson).slice(0, 500) },
        }, { status: 500 });
      }

      // Re-host on Supabase Storage so the URL is durable
      const durableUrl = await rehostImage(outUrl, session.id);
      await prisma.aiPreview.update({
        where: { id: previewId },
        data: { outputImage: durableUrl },
      });
      return NextResponse.json({ done: true, outputUrl: durableUrl });
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      return NextResponse.json({
        error: sJson?.error || `Generation ${status.toLowerCase()}`,
        debug: sJson,
      }, { status: 500 });
    }

    // Still running — return current status + queue position for the UI
    return NextResponse.json({
      done: false,
      status: status || 'IN_PROGRESS',
      queuePosition: sJson?.queue_position,
      lastLog: sJson?.logs?.slice(-1)?.[0]?.message,
    });
  } catch (e: any) {
    console.error('[mirror/status] exception:', e?.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
