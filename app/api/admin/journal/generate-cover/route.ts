import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { generateCoverFromPrompt } from '@/lib/journal/auto-curate';

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
    const prompt = String(body.prompt || '').trim();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const imageUrl = await generateCoverFromPrompt(prompt);

    if (!imageUrl) {
      return NextResponse.json({ error: 'Cover generation failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, imageUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Generate cover failed' }, { status: 500 });
  }
}
