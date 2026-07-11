import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { generateJournalText, normalizeStoryImages } from '@/lib/journal/auto-curate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));

    const result = await generateJournalText({
      forceTheme: body.theme || undefined,
      textPrompt: body.textPrompt || '',
      coverImagePrompt: body.coverImagePrompt || '',
      storyImages: normalizeStoryImages(body.storyImages),
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Generate text failed' }, { status: 500 });
  }
}
