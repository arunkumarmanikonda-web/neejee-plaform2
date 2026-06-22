// Vercel cron — Monday 02:30 UTC = Monday 08:00 IST.
// Configured in vercel.json. Authenticate via CRON_SECRET header.

import { NextResponse } from 'next/server';
import { generateWeeklySummary } from '@/lib/finance/ai-summary';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization') || '';
  return auth === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await generateWeeklySummary({ sendEmail: true });

    // v23.40.19 — also send the digest to Slack #finance for visibility
    try {
      const { postSlack, slack } = await import('@/lib/notifications/slack');
      const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
      const narrative = (result as any).narrative || (result as any).summary || 'Weekly P&L generated.';
      // Trim to Slack-safe length (Slack section block: max 3000 chars)
      const safeNarrative = narrative.length > 2800 ? narrative.slice(0, 2800) + '…' : narrative;
      await postSlack('finance', {
        text: 'Weekly finance digest is ready.',
        icon_emoji: ':chart_with_upwards_trend:',
        blocks: [
          slack.header(':chart_with_upwards_trend: Weekly finance digest'),
          slack.section(safeNarrative),
          slack.divider(),
          slack.button('Open full P&L', `${base}/admin/finance/pnl`),
        ],
      });
    } catch (slackErr: any) {
      console.warn('[cron.weekly-summary] Slack post failed:', slackErr?.message);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[cron.weekly-summary]', err);
    return NextResponse.json({ error: err?.message || 'cron failed' }, { status: 500 });
  }
}
