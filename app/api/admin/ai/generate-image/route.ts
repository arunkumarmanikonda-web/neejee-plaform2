// v23.40.22 — Generic AI image generation endpoint for admin surfaces.
// POST /api/admin/ai/generate-image
// Body: {
//   prompt: string,                    // required
//   aspectRatio?: '16:9'|'1:1'|...     // default '16:9'
//   model?: 'nano-banana-pro'|'flux-schnell'|'flux-kontext'  // default 'nano-banana-pro'
//   referenceImageUrls?: string[],     // for flux-kontext only
//   folder?: string,                   // supabase folder, default 'ai-generated'
//   filenameHint?: string,             // helpful in supabase listing
// }
// Returns: { ok, imageUrl, rawUrl, model, error? }

import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { generateAiImage, type ImageGenModel, type AspectRatio } from '@/lib/ai/generate-image';
import { aiImageConfigured } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!aiImageConfigured()) {
    return NextResponse.json({
      configured: false,
      error: 'AI image generation is not configured. Set FAL_KEY in Vercel env vars.',
    }, { status: 200 });
  }

  try {
    const body = await req.json();
    const prompt = String(body.prompt || '').trim();
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'prompt is too long (max 2000 chars)' }, { status: 400 });
    }

    const aspectRatio = (body.aspectRatio as AspectRatio) || '16:9';
    const model = (body.model as ImageGenModel) || 'nano-banana-pro';
    const referenceImageUrls = Array.isArray(body.referenceImageUrls) ? body.referenceImageUrls : undefined;
    const folder = typeof body.folder === 'string' ? body.folder : 'ai-generated';
    const filenameHint = typeof body.filenameHint === 'string' ? body.filenameHint : 'image';

    const result = await generateAiImage({ prompt, aspectRatio, model, referenceImageUrls, folder, filenameHint });

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.error,
        model: result.model,
      }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[admin.ai.generate-image] error:', e?.message, e?.stack);
    return NextResponse.json({ error: e?.message || 'Image generation failed' }, { status: 500 });
  }
}
