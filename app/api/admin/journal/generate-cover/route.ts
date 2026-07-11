import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

const FAL_BASE = 'https://fal.run';
const FAL_MODEL = 'fal-ai/flux/schnell';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePrompt(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(value: unknown, max = 1000): string {
  const text =
    typeof value === 'string'
      ? value
      : value == null
        ? ''
        : JSON.stringify(value, null, 2);

  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function readResponseBody(res: Response): Promise<string> {
  try {
    return truncate(await res.text());
  } catch {
    return '';
  }
}

function extractImageUrl(payload: any): string | null {
  return (
    payload?.images?.[0]?.url ||
    payload?.output?.images?.[0]?.url ||
    payload?.data?.images?.[0]?.url ||
    payload?.result?.images?.[0]?.url ||
    null
  );
}

async function generateCoverWithDebug(prompt: string): Promise<string> {
  const cleanPrompt = normalizePrompt(prompt);
  if (!cleanPrompt) {
    throw new Error('Cover image prompt is required');
  }

  const key = process.env.FAL_KEY;
  if (!key) {
    throw new Error('FAL_KEY is missing in the server runtime');
  }

  const submitRes = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: cleanPrompt,
      image_size: 'landscape_16_9',
      num_inference_steps: 4,
      num_images: 1,
      enable_safety_checker: false,
    }),
  });

  if (!submitRes.ok) {
    const body = await readResponseBody(submitRes);
    throw new Error(
      `FAL submit failed (${submitRes.status} ${submitRes.statusText})${body ? `: ${body}` : ''}`
    );
  }

  let submitJson: any;
  try {
    submitJson = await submitRes.json();
  } catch {
    throw new Error('FAL submit succeeded but returned non-JSON response');
  }

  const immediateImageUrl = extractImageUrl(submitJson);
  if (immediateImageUrl) {
    return immediateImageUrl;
  }

  const requestId =
    submitJson?.request_id ||
    submitJson?.requestId ||
    submitJson?.id ||
    null;

  if (!requestId) {
    throw new Error(
      `FAL submit succeeded but returned neither image URL nor request id. Payload: ${truncate(submitJson)}`
    );
  }

  const deadline = Date.now() + 90_000;
  let lastStatus = 'UNKNOWN';
  let lastPayload = '';

  while (Date.now() < deadline) {
    await sleep(2000);

    const statusRes = await fetch(
      `${FAL_BASE}/${FAL_MODEL}/requests/${requestId}/status`,
      {
        headers: {
          Authorization: `Key ${key}`,
        },
      }
    );

    if (!statusRes.ok) {
      const body = await readResponseBody(statusRes);
      throw new Error(
        `FAL status check failed (${statusRes.status} ${statusRes.statusText})${body ? `: ${body}` : ''}`
      );
    }

    let statusJson: any;
    try {
      statusJson = await statusRes.json();
    } catch {
      throw new Error('FAL status endpoint returned non-JSON response');
    }

    lastStatus = String(
      statusJson?.status || statusJson?.state || 'UNKNOWN'
    ).toUpperCase();
    lastPayload = truncate(statusJson);

    if (lastStatus === 'FAILED') {
      throw new Error(`FAL job failed: ${lastPayload}`);
    }

    if (lastStatus === 'CANCELED' || lastStatus === 'CANCELLED') {
      throw new Error(`FAL job was canceled: ${lastPayload}`);
    }

    if (lastStatus === 'COMPLETED') {
      const resultUrl =
        statusJson?.response_url ||
        `${FAL_BASE}/${FAL_MODEL}/requests/${requestId}`;

      const resultRes = await fetch(resultUrl, {
        headers: {
          Authorization: `Key ${key}`,
        },
      });

      if (!resultRes.ok) {
        const body = await readResponseBody(resultRes);
        throw new Error(
          `FAL result fetch failed (${resultRes.status} ${resultRes.statusText})${body ? `: ${body}` : ''}`
        );
      }

      let resultJson: any;
      try {
        resultJson = await resultRes.json();
      } catch {
        throw new Error('FAL result endpoint returned non-JSON response');
      }

      const finalImageUrl = extractImageUrl(resultJson);
      if (!finalImageUrl) {
        throw new Error(
          `FAL job completed but no image URL was returned. Payload: ${truncate(resultJson)}`
        );
      }

      return finalImageUrl;
    }
  }

  throw new Error(
    `FAL timed out after 90 seconds. Last status: ${lastStatus}. Last payload: ${lastPayload}`
  );
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const prompt = normalizePrompt(body.prompt);

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const imageUrl = await generateCoverWithDebug(prompt);

    return NextResponse.json({
      ok: true,
      imageUrl,
    });
  } catch (e: any) {
    const message =
      typeof e?.message === 'string' && e.message.trim()
        ? e.message.trim()
        : 'Generate cover failed';

    console.error('[journal.generate-cover]', message, e);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
