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

function clamp(value: string, max: number) {
  return value.trim().replace(/\s+/g, ' ').slice(0, max);
}

function normalizeAbsoluteUrl(value: string, fallback: string) {
  try {
    return new URL(value).toString();
  } catch {
    return fallback;
  }
}

function deterministicDraft(values: SeoValues, objective: string) {
  const shortObjective = clamp(objective || 'founder-led Indian craft discovery and gift intent', 90);
  const siteName = clamp(values.NEXT_PUBLIC_SITE_NAME || 'NEEJEE', 32) || 'NEEJEE';

  const titleBase = `${siteName} | Indian craft, found personal`;
  const descriptionBase = `Founder-led Indian craft discovery for sarees, jewellery, attars, gifting, and heirloom details. ${shortObjective}.`;
  const keywordSeed = [
    'Indian craft',
    'founder selected',
    'Banarasi saree',
    'handloom gifting',
    'artisanal jewellery',
    'attar',
  ];

  return {
    values: {
      ...values,
      NEXT_PUBLIC_DEFAULT_META_TITLE: clamp(titleBase, 60),
      NEXT_PUBLIC_META_TITLE_TEMPLATE: clamp(`%s | ${siteName}`, 60),
      NEXT_PUBLIC_DEFAULT_META_DESCRIPTION: clamp(descriptionBase, 160),
      NEXT_PUBLIC_META_KEYWORDS: clamp(
        Array.from(new Set([...values.NEXT_PUBLIC_META_KEYWORDS.split(',').map((v) => v.trim()).filter(Boolean), ...keywordSeed])).join(', '),
        220
      ),
      NEXT_PUBLIC_OG_TITLE: clamp(titleBase, 60),
      NEXT_PUBLIC_OG_DESCRIPTION: clamp(descriptionBase, 160),
      NEXT_PUBLIC_TWITTER_TITLE: clamp(titleBase, 60),
      NEXT_PUBLIC_TWITTER_DESCRIPTION: clamp(descriptionBase, 160),
      NEXT_PUBLIC_CANONICAL_BASE_URL: normalizeAbsoluteUrl(values.NEXT_PUBLIC_CANONICAL_BASE_URL, 'https://neejee.com'),
      NEXT_PUBLIC_ROBOTS_INDEX: values.NEXT_PUBLIC_ROBOTS_INDEX || 'true',
      NEXT_PUBLIC_ROBOTS_FOLLOW: values.NEXT_PUBLIC_ROBOTS_FOLLOW || 'true',
    } as SeoValues,
    rationale: [
      'Tightened title and social lines toward a founder-led Indian craft position.',
      'Trimmed descriptions toward search-friendly length.',
      'Normalized canonical base and preserved robots flags.',
    ],
  };
}

function normalizeCandidate(candidate: any, current: SeoValues): SeoValues {
  const next = { ...current };
  for (const key of SEO_FIELD_ORDER) {
    if (typeof candidate?.[key] === 'string' && candidate[key].trim()) {
      next[key] = candidate[key].trim();
    }
  }

  next.NEXT_PUBLIC_SITE_NAME = clamp(next.NEXT_PUBLIC_SITE_NAME, 40);
  next.NEXT_PUBLIC_CANONICAL_BASE_URL = normalizeAbsoluteUrl(next.NEXT_PUBLIC_CANONICAL_BASE_URL, current.NEXT_PUBLIC_CANONICAL_BASE_URL || 'https://neejee.com');
  next.NEXT_PUBLIC_DEFAULT_META_TITLE = clamp(next.NEXT_PUBLIC_DEFAULT_META_TITLE, 60);
  next.NEXT_PUBLIC_META_TITLE_TEMPLATE = clamp(next.NEXT_PUBLIC_META_TITLE_TEMPLATE, 60);
  next.NEXT_PUBLIC_DEFAULT_META_DESCRIPTION = clamp(next.NEXT_PUBLIC_DEFAULT_META_DESCRIPTION, 160);
  next.NEXT_PUBLIC_META_KEYWORDS = clamp(next.NEXT_PUBLIC_META_KEYWORDS, 220);
  next.NEXT_PUBLIC_OG_TITLE = clamp(next.NEXT_PUBLIC_OG_TITLE, 60);
  next.NEXT_PUBLIC_OG_DESCRIPTION = clamp(next.NEXT_PUBLIC_OG_DESCRIPTION, 160);
  next.NEXT_PUBLIC_TWITTER_TITLE = clamp(next.NEXT_PUBLIC_TWITTER_TITLE, 60);
  next.NEXT_PUBLIC_TWITTER_DESCRIPTION = clamp(next.NEXT_PUBLIC_TWITTER_DESCRIPTION, 160);
  next.NEXT_PUBLIC_ROBOTS_INDEX = String(next.NEXT_PUBLIC_ROBOTS_INDEX).trim().toLowerCase() === 'false' ? 'false' : 'true';
  next.NEXT_PUBLIC_ROBOTS_FOLLOW = String(next.NEXT_PUBLIC_ROBOTS_FOLLOW).trim().toLowerCase() === 'false' ? 'false' : 'true';

  return next;
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const objective = typeof body?.objective === 'string' ? body.objective.trim() : '';
    const values = sanitizeIncoming(body?.values || {});
    const fallback = deterministicDraft(values, objective);

    if (!aiTextConfigured()) {
      return NextResponse.json({
        ok: true,
        configured: false,
        note: 'OPENAI_API_KEY not configured. Applied deterministic SEO draft.',
        values: fallback.values,
        rationale: fallback.rationale,
      });
    }

    const system = `You are NEEJEE's SEO strategist.
Return strict JSON only.
You are rewriting site-wide default metadata for a founder-led Indian craft brand.
Voice: quiet, precise, founder-led, Indian craft specific, never hypey.
Avoid: premium, exquisite, luxurious, best-in-class, emojis, exclamation marks.
Prefer: specific craft language, trust, discovery intent, gifting intent, founder curation.

Return this exact JSON shape:
{
  "values": {
    "NEXT_PUBLIC_SITE_NAME": "...",
    "NEXT_PUBLIC_CANONICAL_BASE_URL": "...",
    "NEXT_PUBLIC_DEFAULT_META_TITLE": "...",
    "NEXT_PUBLIC_META_TITLE_TEMPLATE": "...",
    "NEXT_PUBLIC_DEFAULT_META_DESCRIPTION": "...",
    "NEXT_PUBLIC_META_KEYWORDS": "...",
    "NEXT_PUBLIC_OG_TITLE": "...",
    "NEXT_PUBLIC_OG_DESCRIPTION": "...",
    "NEXT_PUBLIC_OG_IMAGE_URL": "...",
    "NEXT_PUBLIC_TWITTER_TITLE": "...",
    "NEXT_PUBLIC_TWITTER_DESCRIPTION": "...",
    "NEXT_PUBLIC_ROBOTS_INDEX": "true",
    "NEXT_PUBLIC_ROBOTS_FOLLOW": "true"
  },
  "rationale": ["...", "...", "..."]
}

Constraints:
- Titles <= 60 chars.
- Descriptions <= 160 chars.
- Keep OG image URL unless the current value is obviously invalid.
- Canonical base must be an absolute URL.
- Robots fields must be strings: "true" or "false".
- Keep output ready to save directly to env-backed settings.`;

    const userMessage = `Objective:
${objective || 'Improve default SEO for founder-led Indian craft discovery and social preview clarity.'}

Current values:
${JSON.stringify(values, null, 2)}

Return the upgraded default metadata now.`;

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.4,
      jsonMode: true,
    });

    if (!ai.ok) {
      return NextResponse.json({ error: ai.error || 'AI draft failed' }, { status: 500 });
    }

    const candidate = ai.json || {};
    const normalized = normalizeCandidate(candidate.values || {}, values);

    return NextResponse.json({
      ok: true,
      configured: true,
      note: 'AI draft generated and normalized for direct application.',
      values: normalized,
      rationale: Array.isArray(candidate.rationale) ? candidate.rationale.slice(0, 6).map((item: any) => String(item)) : fallback.rationale,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI draft failed' }, { status: 500 });
  }
}