import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { curateWeeklyJournal } from '@/lib/journal/auto-curate';
import { sendJournalReviewEmail } from '@/lib/journal/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const drafts = await prisma.journalDraft.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      title: true,
      excerpt: true,
      coverImage: true,
      coverImagePrompt: true,
      tags: true,
      seedTheme: true,
      seedRef: true,
      status: true,
      createdByCron: true,
      createdAt: true,
      reviewedAt: true,
      publishedPageId: true,
      storyImages: true,
    },
  });

  return NextResponse.json({ drafts });
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));

    const draft = await curateWeeklyJournal({
      forceTheme: body.theme || undefined,
      createdByCron: false,
      textPrompt: body.textPrompt || null,
      coverImagePrompt: body.coverImagePrompt || null,
      coverImageUrl: body.coverImageUrl || null,
      storyImages: Array.isArray(body.storyImages) ? body.storyImages : [],
      manualTitle: body.manualTitle || null,
      manualExcerpt: body.manualExcerpt || null,
      manualBody: body.manualBody || null,
      manualTags: Array.isArray(body.manualTags) ? body.manualTags : [],
    });

    let emailRes = { sent: 0, recipients: [] as string[] };
    try {
      emailRes = await sendJournalReviewEmail(draft);
    } catch (e) {
      console.error('[admin.journal.drafts] email failed', e);
    }

    return NextResponse.json({ ok: true, draft, email: emailRes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Generate failed' }, { status: 500 });
  }
}
