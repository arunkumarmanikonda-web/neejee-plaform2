// /api/admin/journal/drafts
// GET  - list all drafts (newest first)
// POST - manually trigger a new draft (calls curateWeeklyJournal + email)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { curateWeeklyJournal } from '@/lib/journal/auto-curate';
import { sendJournalReviewEmail } from '@/lib/journal/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Manual trigger can spend ~90s drafting + image gen.
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
      id: true, title: true, excerpt: true, coverImage: true, tags: true,
      seedTheme: true, seedRef: true, status: true, createdByCron: true,
      createdAt: true, reviewedAt: true, publishedPageId: true,
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
    const body = await req.json().catch(() => ({}));
    const forceTheme = body.theme || undefined;
    const draft = await curateWeeklyJournal({ forceTheme, createdByCron: false });
    // Send email asynchronously (don't fail the request if email is slow/broken)
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
