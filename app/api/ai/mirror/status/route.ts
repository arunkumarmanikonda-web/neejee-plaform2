// Poll fal.ai for the current status of a try-on job.
// Provider URLs are treated as untrusted client input and must remain on approved hosts.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { uploadFile, makeUploadPath, storageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const FAL_BASE = 'https://queue.fal.run';
const FAL_API_HOSTS = new Set(['queue.fal.run', 'fal.run']);
const FAL_IMAGE_HOST_SUFFIXES = ['fal.media', 'fashn.ai', 'fal.run'];
const ENDPOINT_RE = /^[a-zA-Z0-9._/-]+$/;
const REQUEST_ID_RE = /^[a-zA-Z0-9._-]+$/;

function isAllowedFalApiUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' && FAL_API_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function trustedFalApiUrl(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  if (!isAllowedFalApiUrl(candidate)) {
    throw new Error('Untrusted AI provider URL');
  }
  return candidate;
}

function isAllowedProviderImageUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return FAL_IMAGE_HOST_SUFFIXES.some(
      suffix => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

/** Download an approved provider image and re-upload it to our Supabase bucket. */
async function rehostImage(providerUrl: string, userId: string): Promise<string> {
  if (!isAllowedProviderImageUrl(providerUrl)) {
    throw new Error('AI provider returned an untrusted image URL');
  }

  if (!storageConfigured()) {
    return providerUrl;
  }

  const res = await fetch(providerUrl, {
    cache: 'no-store',
    redirect: 'error',
  });
  if (!res.ok) throw new Error(`AI image download failed: ${res.status}`);

  const contentType = res.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('AI provider returned a non-image response');
  }

  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const buf = Buffer.from(await res.arrayBuffer());
  const path = makeUploadPath(`ai-mirror/${userId}`, `mirror-${Date.now()}.${ext}`);
  const { url } = await uploadFile(path, buf, contentType);
  return url;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const requestId = url.searchParams.get('id');
  const previewId = url.searchParams.get('previewId');
  const endpoint = url.searchParams.get('endpoint');
  const passedStatusUrl = url.searchParams.get('statusUrl');
  const passedResponseUrl = url.searchParams.get('responseUrl');

  if (!requestId || !previewId || !endpoint) {
    return NextResponse.json({ error: 'id, previewId and endpoint required' }, { status: 400 });
  }
  if (!REQUEST_ID_RE.test(requestId) || !ENDPOINT_RE.test(endpoint) || endpoint.includes('..')) {
    return NextResponse.json({ error: 'Invalid AI provider job reference' }, { status: 400 });
  }

  // Verify the preview belongs to this user before touching the provider.
  const preview = await prisma.aiPreview.findUnique({
    where: { id: previewId },
    select: { id: true, userId: true, outputImage: true },
  });
  if (!preview || preview.userId !== session.id) {
    return NextResponse.json({ error: 'Preview not found' }, { status: 404 });
  }

  if (preview.outputImage) {
    return NextResponse.json({ done: true, outputUrl: preview.outputImage });
  }

  const key = process.env.FAL_KEY;
  if (!key) return NextResponse.json({ error: 'AI provider is not configured' }, { status: 503 });

  const fallbackStatusUrl = `${FAL_BASE}/${endpoint}/requests/${requestId}/status`;
  let statusUrl: string;
  try {
    statusUrl = trustedFalApiUrl(passedStatusUrl, fallbackStatusUrl);
  } catch {
    return NextResponse.json({ error: 'Invalid AI provider status URL' }, { status: 400 });
  }

  try {
    const sRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${key}` },
      cache: 'no-store',
      redirect: 'error',
    });
    const sJson = await sRes.json().catch(() => ({}));

    console.log('[mirror/status] poll result:', {
      requestId: requestId.slice(0, 12) + '...',
      httpStatus: sRes.status,
      falStatus: sJson?.status,
      queuePosition: sJson?.queue_position,
      logsCount: sJson?.logs?.length,
      lastLog: sJson?.logs?.slice(-1)?.[0]?.message,
      hasResponseUrl: !!sJson?.response_url,
    });

    if (!sRes.ok) {
      return NextResponse.json({
        error: sJson?.error || sJson?.detail || `AI status check failed (${sRes.status})`,
      }, { status: 502 });
    }

    const status = sJson.status as string | undefined;

    if (status === 'COMPLETED') {
      const fallbackResultUrl = `${FAL_BASE}/${endpoint}/requests/${requestId}`;
      const providerResultCandidate = sJson.response_url || passedResponseUrl;
      let resultUrl: string;
      try {
        resultUrl = trustedFalApiUrl(providerResultCandidate, fallbackResultUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid AI provider response URL' }, { status: 502 });
      }

      const rRes = await fetch(resultUrl, {
        headers: { Authorization: `Key ${key}` },
        cache: 'no-store',
        redirect: 'error',
      });
      const rJson = await rRes.json().catch(() => ({}));

      const outUrl: string | undefined =
        rJson?.images?.[0]?.url ||
        rJson?.image?.url ||
        rJson?.output?.images?.[0]?.url ||
        rJson?.output?.[0]?.url ||
        rJson?.output_url;

      if (!rRes.ok || !outUrl) {
        return NextResponse.json({
          error: !rRes.ok
            ? `AI result fetch failed (${rRes.status})`
            : 'AI generation completed without an image',
        }, { status: 502 });
      }

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
      }, { status: 502 });
    }

    return NextResponse.json({
      done: false,
      status: status || 'IN_PROGRESS',
      queuePosition: sJson?.queue_position,
      lastLog: sJson?.logs?.slice(-1)?.[0]?.message,
    });
  } catch (e: any) {
    console.error('[mirror/status] exception:', e?.message);
    return NextResponse.json({ error: 'Unable to reach the AI provider' }, { status: 502 });
  }
}
