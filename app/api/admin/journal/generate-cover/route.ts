import { generateCoverFromPrompt } from '@/lib/journal/auto-curate';
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 240;

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const imageUrl = await generateCoverFromPrompt(prompt);
    if (!imageUrl) return NextResponse.json({ error: 'Cover generation is unavailable. Please try again later.' }, { status: 502 });

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
