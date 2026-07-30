import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { aiTextConfigured, openaiChat } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

type CategoryRow = {
  id?: string;
  slug?: string;
  name?: string;
  parentId?: string | null;
  level?: number;
  path?: string | null;
  active?: boolean;
  hidden?: boolean;
  gender?: string | null;
};

type TaxonomyPlan = {
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  level: number;
  gender: string | null;
  reasoning: string[];
  sampleChildren: string[];
  seoTitle: string;
  seoDescription: string;
};

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[^\w\s\-&]/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCase(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function labelFromObjective(objective: string) {
  const stop = new Set(['for','with','that','this','from','into','your','their','about','under','over','through','before','after','new','create','category','taxonomy','surface','node']);
  const parts = objective
    .replace(/[^a-zA-Z0-9\s&-]/g, ' ')
    .split(/\s+/)
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !stop.has(p.toLowerCase()));

  const take = parts.slice(0, 3);
  return titleCase(take.join(' ') || 'Founder Edit');
}

function matchParent(objective: string, categories: CategoryRow[]) {
  const lower = objective.toLowerCase();
  const active = categories.filter(c => c.active !== false && !c.hidden);

  const rules: Array<{ test: RegExp; keys: string[] }> = [
    { test: /jewel|jewellery|jewelry|accessor|bag|shawl|stole/, keys: ['accessories'] },
    { test: /attar|fragrance|perfume/, keys: ['fragrance'] },
    { test: /gift|gifting|favour|favor|wedding|return gift/, keys: ['gifting'] },
    { test: /lamp|decor|home|table|cushion|rugs|textile|serveware/, keys: ['home'] },
    { test: /men|mens|sherwani|bandhgala|nehru|kurta/, keys: ['men'] },
    { test: /women|saree|sarees|dupatta|lehenga|kurta set|bridal/, keys: ['women'] },
  ];

  for (const rule of rules) {
    if (!rule.test.test(lower)) continue;
    const hit = active.find(c => {
      const hay = `${c.name || ''} ${c.slug || ''} ${c.path || ''}`.toLowerCase();
      return rule.keys.some(k => hay.includes(k));
    });
    if (hit) return hit;
  }

  return active.find(c => c.level === 1 && `${c.name || ''} ${c.slug || ''}`.toLowerCase().includes('women')) || active.find(c => c.level === 1) || null;
}

function deterministicPlan(objective: string, categories: CategoryRow[]): TaxonomyPlan {
  const parent = matchParent(objective, categories);
  const name = labelFromObjective(objective);
  const slug = slugify(name);

  const gender =
    /men|mens|sherwani|bandhgala|nehru|kurta/.test(objective.toLowerCase()) ? 'MEN' :
    /women|womens|saree|dupatta|lehenga|bridal/.test(objective.toLowerCase()) ? 'WOMEN' :
    parent?.gender || null;

  return {
    name,
    slug,
    parentId: parent?.id || null,
    parentName: parent?.name || null,
    level: parent?.level ? parent.level + 1 : 1,
    gender,
    reasoning: [
      'Matched the proposed node against the current taxonomy to avoid creating an isolated branch.',
      'Kept the suggestion narrow enough to be merchandisable without turning it into a product catalogue change.',
      'Prepared a clean starter SEO layer so CMS and search surfaces can follow quickly if the node is approved.',
    ],
    sampleChildren: [
      `${name} Edits`,
      `${name} Gifts`,
      `${name} New Arrivals`,
    ],
    seoTitle: `${name} | NEEJEE`,
    seoDescription: `Browse ${name.toLowerCase()} through a founder-led Indian craft lens, with room for curation, gifting, and editorial expansion.`,
  };
}

function resolveParent(candidate: any, categories: CategoryRow[], fallback: CategoryRow | null) {
  if (candidate?.parentId) {
    const byId = categories.find(c => c.id === candidate.parentId);
    if (byId) return byId;
  }

  const hint = String(candidate?.parentName || candidate?.parentSlug || '').trim().toLowerCase();
  if (hint) {
    const byName = categories.find(c => `${c.name || ''}`.toLowerCase() === hint);
    if (byName) return byName;

    const bySlug = categories.find(c => `${c.slug || ''}`.toLowerCase() === hint);
    if (bySlug) return bySlug;

    const byPath = categories.find(c => `${c.path || ''}`.toLowerCase().includes(hint));
    if (byPath) return byPath;
  }

  return fallback;
}

function normalizePlan(candidate: any, fallback: TaxonomyPlan, categories: CategoryRow[]): TaxonomyPlan {
  const fallbackParent = fallback.parentId ? categories.find(c => c.id === fallback.parentId) || null : null;
  const parent = resolveParent(candidate, categories, fallbackParent);
  const name = titleCase(String(candidate?.name || fallback.name).trim()).slice(0, 80) || fallback.name;
  const slug = slugify(String(candidate?.slug || name || fallback.slug)).slice(0, 100) || fallback.slug;
  const genderRaw = String(candidate?.gender || fallback.gender || '').trim().toUpperCase();
  const gender = ['MEN', 'WOMEN', 'UNISEX'].includes(genderRaw) ? genderRaw : (fallback.gender || null);

  return {
    name,
    slug,
    parentId: parent?.id || null,
    parentName: parent?.name || null,
    level: parent?.level ? parent.level + 1 : 1,
    gender,
    reasoning: Array.isArray(candidate?.reasoning)
      ? candidate.reasoning.slice(0, 6).map((item: any) => String(item))
      : fallback.reasoning,
    sampleChildren: Array.isArray(candidate?.sampleChildren)
      ? candidate.sampleChildren.slice(0, 6).map((item: any) => String(item)).filter(Boolean)
      : fallback.sampleChildren,
    seoTitle: String(candidate?.seoTitle || fallback.seoTitle).trim().slice(0, 80),
    seoDescription: String(candidate?.seoDescription || fallback.seoDescription).trim().slice(0, 180),
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const objective = String(body?.objective || '').trim();
    const categories = Array.isArray(body?.categories) ? body.categories : [];

    if (objective.length < 5) {
      return NextResponse.json({ error: 'Objective required' }, { status: 400 });
    }

    const fallback = deterministicPlan(objective, categories);

    if (!aiTextConfigured()) {
      return NextResponse.json({
        ok: true,
        configured: false,
        plan: fallback,
      });
    }

    const system = `You are NEEJEE's taxonomy strategist.
Return strict JSON only.
You are planning a new taxonomy node for an Indian craft commerce brand.
Do NOT rewrite products or catalogue entries.
Stay within category planning.

Return exactly:
{
  "name": "...",
  "slug": "...",
  "parentId": "..." or null,
  "parentName": "..." or null,
  "gender": "MEN" or "WOMEN" or "UNISEX" or null,
  "reasoning": ["...", "...", "..."],
  "sampleChildren": ["...", "...", "..."],
  "seoTitle": "...",
  "seoDescription": "..."
}

Rules:
- Prefer attaching to an existing parent where possible.
- Keep names concise and merchandisable.
- slug should be lowercase and hyphen-ready.
- sampleChildren should be child ideas, not products.
- Keep seoDescription short and usable.`;

    const userMessage = `Objective:
${objective}

Current taxonomy snapshot:
${JSON.stringify(categories, null, 2)}

Return the best new taxonomy node suggestion now.`;

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0.3,
      jsonMode: true,
    });

    if (!ai.ok) {
      return NextResponse.json({ error: ai.error || 'AI taxonomy planning failed' }, { status: 500 });
    }

    const normalized = normalizePlan(ai.json || {}, fallback, categories);

    return NextResponse.json({
      ok: true,
      configured: true,
      plan: normalized,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI taxonomy planning failed' }, { status: 500 });
  }
}