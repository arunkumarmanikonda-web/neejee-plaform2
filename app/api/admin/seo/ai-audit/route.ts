import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { aiTextConfigured, openaiChat } from '@/lib/ai';
import { SEO_FIELD_ORDER, SEO_FIELD_META, type SeoFieldKey } from '@/lib/site/seo-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

type SeoValues = Record<SeoFieldKey, string>;

const DEFAULT_VALUES = SEO_FIELD_ORDER.reduce((acc, key) => {
  acc[key] = SEO_FIELD_META[key].defaultValue;
  return acc;
}, {} as SeoValues);

function sanitizeIncoming(input: any): SeoValues {
  const next = { ...DEFAULT_VALUES };
  for (const key of SEO_FIELD_ORDER) {
    if (typeof input?.[key] === 'string' && input[key].trim()) {
      next[key] = input[key].trim();
    }
  }
  return next;
}

function isAbsoluteUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function heuristicAudit(values: SeoValues) {
  const wins: string[] = [];
  const issues: string[] = [];
  const nextActions: string[] = [];
  let score = 100;

  const titleLen = values.NEXT_PUBLIC_DEFAULT_META_TITLE.trim().length;
  const descLen = values.NEXT_PUBLIC_DEFAULT_META_DESCRIPTION.trim().length;
  const ogDescLen = values.NEXT_PUBLIC_OG_DESCRIPTION.trim().length;
  const twitterDescLen = values.NEXT_PUBLIC_TWITTER_DESCRIPTION.trim().length;
  const keywordCount = values.NEXT_PUBLIC_META_KEYWORDS.split(',').map((v) => v.trim()).filter(Boolean).length;

  if (titleLen >= 35 && titleLen <= 60) wins.push('Default title is within a strong search length range.');
  else { issues.push('Default title should usually sit between 35 and 60 characters.'); score -= 12; }

  if (descLen >= 120 && descLen <= 160) wins.push('Default meta description is close to ideal search snippet length.');
  else { issues.push('Default meta description should usually sit between 120 and 160 characters.'); score -= 12; }

  if (ogDescLen >= 80 && ogDescLen <= 160) wins.push('Open Graph description is usable for social preview copy.');
  else { issues.push('Open Graph description is weak or overlong for social preview use.'); score -= 8; }

  if (twitterDescLen >= 60 && twitterDescLen <= 160) wins.push('Twitter description is present and usable.');
  else { issues.push('Twitter description needs tightening for better card previews.'); score -= 6; }

  if (isAbsoluteUrl(values.NEXT_PUBLIC_CANONICAL_BASE_URL)) wins.push('Canonical base URL is absolute.');
  else { issues.push('Canonical base URL must be a valid absolute URL.'); score -= 15; }

  if (isAbsoluteUrl(values.NEXT_PUBLIC_OG_IMAGE_URL)) wins.push('Open Graph image URL is absolute.');
  else { issues.push('Open Graph image URL must be absolute for social cards.'); score -= 12; }

  if (keywordCount >= 5) wins.push('Keyword coverage is broad enough for a baseline metadata layer.');
  else { issues.push('Keyword set is too thin for a strong baseline footprint.'); score -= 8; }

  if (String(values.NEXT_PUBLIC_ROBOTS_INDEX).toLowerCase() === 'true' && String(values.NEXT_PUBLIC_ROBOTS_FOLLOW).toLowerCase() === 'true') {
    wins.push('Robots directives allow indexing and crawling.');
  } else {
    issues.push('Robots directives are restrictive; verify this is intentional.');
    score -= 10;
  }

  if (!issues.length) nextActions.push('Save the current set as-is and redeploy when convenient.');
  if (titleLen < 35 || titleLen > 60) nextActions.push('Tighten the default title before saving.');
  if (descLen < 120 || descLen > 160) nextActions.push('Rewrite the default meta description for clearer search intent.');
  if (!isAbsoluteUrl(values.NEXT_PUBLIC_OG_IMAGE_URL)) nextActions.push('Replace the OG image with a valid absolute URL.');
  if (keywordCount < 5) nextActions.push('Expand keyword coverage with craft, occasion, and gifting intent terms.');

  const summary =
    score >= 85
      ? 'Strong baseline SEO defaults with only minor tuning left.'
      : score >= 70
        ? 'Usable baseline SEO defaults, but there are a few meaningful fixes to make.'
        : 'Current defaults need revision before they should be treated as the SEO baseline.';

  return {
    score: Math.max(0, Math.min(100, score)),
    summary,
    wins: wins.slice(0, 6),
    issues: issues.slice(0, 6),
    nextActions: nextActions.slice(0, 6),
  };
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const values = sanitizeIncoming(body?.values || {});
    const baseAudit = heuristicAudit(values);

    if (!aiTextConfigured()) {
      return NextResponse.json({
        ok: true,
        configured: false,
        audit: baseAudit,
      });
    }

    const system = `You are NEEJEE's SEO reviewer.
Return strict JSON only.
Review the default site-wide metadata for a founder-led Indian craft brand.

Return this exact JSON shape:
{
  "score": 0,
  "summary": "...",
  "wins": ["...", "..."],
  "issues": ["...", "..."],
  "nextActions": ["...", "..."]
}

Constraints:
- Score must be 0-100.
- Keep wins/issues/actions concise and implementation-ready.
- Focus on search snippet quality, social preview quality, canonical correctness, keyword breadth, and robots directives.
- Do not mention implementation details like code or env vars.`;

    const userMessage = `Review these current default SEO values:

${JSON.stringify(values, null, 2)}

Also keep these heuristic findings in mind:
${JSON.stringify(baseAudit, null, 2)}

Return the final audit now.`;

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.2,
      jsonMode: true,
    });

    if (!ai.ok) {
      return NextResponse.json({ error: ai.error || 'AI audit failed' }, { status: 500 });
    }

    const candidate = ai.json || {};
    return NextResponse.json({
      ok: true,
      configured: true,
      audit: {
        score: typeof candidate.score === 'number' ? Math.max(0, Math.min(100, candidate.score)) : baseAudit.score,
        summary: typeof candidate.summary === 'string' && candidate.summary.trim() ? candidate.summary.trim() : baseAudit.summary,
        wins: Array.isArray(candidate.wins) ? candidate.wins.slice(0, 6).map((item: any) => String(item)) : baseAudit.wins,
        issues: Array.isArray(candidate.issues) ? candidate.issues.slice(0, 6).map((item: any) => String(item)) : baseAudit.issues,
        nextActions: Array.isArray(candidate.nextActions) ? candidate.nextActions.slice(0, 6).map((item: any) => String(item)) : baseAudit.nextActions,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI audit failed' }, { status: 500 });
  }
}