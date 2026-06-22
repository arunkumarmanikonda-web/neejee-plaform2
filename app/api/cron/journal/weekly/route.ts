// Vercel cron — Monday 03:30 UTC = Monday 09:00 IST.
// Generates a new journal draft, persists it, and emails Nidhi + admins for approval.
// Configured in vercel.json. Authenticate via CRON_SECRET header.

import { NextResponse } from 'next/server';
import { curateWeeklyJournal } from '@/lib/journal/auto-curate';
import { sendJournalReviewEmail } from '@/lib/journal/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Drafting + cover image gen + email can take up to ~90s. Allow 5min cap.
export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // v23.40.21 — Soft-fail the cron: return 200 with diagnostic info even when
  // OpenAI / image gen / email fails. Hard 500s spam Vercel's cron error log
  // and aren't actionable for transient AI outages.
  let draft: any = null;
  let emailRes: any = null;
  const issues: string[] = [];

  try {
    draft = await curateWeeklyJournal({ createdByCron: true });
  } catch (err: any) {
    console.error('[cron.journal.weekly] draft generation failed:', err?.message);
    issues.push(`draft: ${err?.message || 'unknown error'}`);
    return NextResponse.json({
      ok: false,
      degraded: true,
      stage: 'draft',
      reason: err?.message || 'draft generation failed',
      hint: err?.message?.includes('OPENAI_API_KEY')
        ? 'Set OPENAI_API_KEY in Vercel env vars and redeploy.'
        : 'Check OpenAI quota / network connectivity / journal seed data availability.',
    }, { status: 200 }); // 200 so cron retry behaviour doesn't fire on AI outages
  }

  try {
    emailRes = await sendJournalReviewEmail(draft);
  } catch (err: any) {
    console.error('[cron.journal.weekly] email failed:', err?.message);
    issues.push(`email: ${err?.message || 'unknown error'}`);
  }

  return NextResponse.json({
    ok: true,
    draftId: draft.draftId,
    title: draft.title,
    theme: draft.theme,
    coverGenerated: !!draft.coverImage,
    emailsSent: emailRes?.sent || 0,
    recipients: emailRes?.recipients?.length || 0,
    issues: issues.length ? issues : undefined,
  });
}
