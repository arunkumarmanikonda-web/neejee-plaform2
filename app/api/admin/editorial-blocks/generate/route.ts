import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import {
  editorialBlocksAiConfigured,
  generateEditorialBlockCopy,
  generateEditorialBlockCover,
} from '@/lib/editorial-blocks/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

function asText(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

function asTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asText(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const mode = asText(body.mode).toLowerCase() || 'both';

    if (!['text', 'cover', 'both'].includes(mode)) {
      return NextResponse.json(
        { error: 'Mode must be text, cover, or both' },
        { status: 400 }
      );
    }

    const textEnabled = editorialBlocksAiConfigured();

    if ((mode === 'text' || mode === 'both') && !textEnabled) {
      return NextResponse.json(
        {
          ok: true,
          configured: false,
          message: 'AI text generation is not configured. Add OPENAI_API_KEY.',
        },
        { status: 200 }
      );
    }

    let copy: any = null;
    let imageUrl: string | null = null;
    let coverImagePrompt: string | null = asText(body.coverImagePrompt) || null;

    if (mode === 'text' || mode === 'both') {
      copy = await generateEditorialBlockCopy({
        title: body.title,
        blockType: body.blockType,
        body: body.body,
        subhead: body.subhead,
        kicker: body.kicker,
        audienceTag: body.audienceTag,
        placement: body.placement,
        ctaLabel: body.ctaLabel,
        ctaHref: body.ctaHref,
        tags: asTags(body.tags),
        coverImagePrompt: body.coverImagePrompt,
      });

      coverImagePrompt = copy.coverImagePrompt || coverImagePrompt;
    }

    if (mode === 'cover' || mode === 'both') {
      const fallbackPrompt =
        coverImagePrompt ||
        asText(body.title) ||
        asText(body.body) ||
        'Premium Neejee editorial campaign image';

      imageUrl = await generateEditorialBlockCover(fallbackPrompt);
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      result: {
        copy,
        imageUrl,
        coverImagePrompt,
      },
    });
  } catch (e: any) {
    const message =
      typeof e?.message === 'string' && e.message.trim()
        ? e.message.trim()
        : 'Editorial block generation failed';

    console.error('[editorial-blocks.generate]', message, e);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
