import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { aiTextConfigured, openaiChat } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type CategoryRow = {
  id?: string;
  slug?: string;
  name?: string;
  parentId?: string | null;
  level?: number;
  path?: string | null;
  active?: boolean;
  hidden?: boolean;
  featured?: boolean;
  aiGenerated?: boolean;
  gender?: string | null;
};

type TaxonomyPlan = {
  objective: string;
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
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeGender(value: any): string | null {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'men' || raw === 'male') return 'men';
  if (raw === 'women' || raw === 'female') return 'women';
  if (raw === 'unisex') return 'unisex';
  return null;
}

function labelFromObjective(objective: string) {
  const stop = new Set(['for','with','that','this','from','into','your','their','about','under','over','through','before','after','new','create','category','taxonomy','surface','node']);
  const parts = objective
    .replace(/[^a-zA-Z0-9\s&-]/g, ' ')
    .split(/\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !stop.has(p.toLowerCase()));

  const take = parts.slice(0, 3);
  return titleCase(take.join(' ') || 'Founder Edit');
}

function matchParent(objective: string, categories: CategoryRow[]) {
  const lower = objective.toLowerCase();
  const active = categories.filter((c) => c.active !== false && !c.hidden);

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
    const hit = active.find((c) => {
      const hay = `${c.name || ''} ${c.slug || ''} ${c.path || ''}`.toLowerCase();
      return rule.keys.some((k) => hay.includes(k));
    });
    if (hit) return hit;
  }

  return active.find((c) => c.level === 1 && `${c.name || ''} ${c.slug || ''}`.toLowerCase().includes('women'))
    || active.find((c) => c.level === 1)
    || null;
}

function deterministicPlan(objective: string, categories: CategoryRow[]): TaxonomyPlan {
  const parent = matchParent(objective, categories);
  const name = labelFromObjective(objective);
  const slug = slugify(name);

  const gender =
    /men|mens|sherwani|bandhgala|nehru|kurta/.test(objective.toLowerCase()) ? 'MEN' :
    /women|womens|saree|dupatta|lehenga|bridal/.test(objective.toLowerCase()) ? 'WOMEN' :
    (parent?.gender ? String(parent.gender).toUpperCase() : null);

  return {
    objective,
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
    const byId = categories.find((c) => c.id === candidate.parentId);
    if (byId) return byId;
  }

  const hint = String(candidate?.parentName || candidate?.parentSlug || '').trim().toLowerCase();
  if (hint) {
    const byName = categories.find((c) => `${c.name || ''}`.toLowerCase() === hint);
    if (byName) return byName;

    const bySlug = categories.find((c) => `${c.slug || ''}`.toLowerCase() === hint);
    if (bySlug) return bySlug;

    const byPath = categories.find((c) => `${c.path || ''}`.toLowerCase().includes(hint));
    if (byPath) return byPath;
  }

  return fallback;
}

function normalizePlan(candidate: any, fallback: TaxonomyPlan, categories: CategoryRow[]): TaxonomyPlan {
  const fallbackParent = fallback.parentId ? categories.find((c) => c.id === fallback.parentId) || null : null;
  const parent = resolveParent(candidate, categories, fallbackParent);
  const name = titleCase(String(candidate?.name || fallback.name).trim()).slice(0, 80) || fallback.name;
  const slug = slugify(String(candidate?.slug || name || fallback.slug)).slice(0, 100) || fallback.slug;
  const genderRaw = String(candidate?.gender || fallback.gender || '').trim().toUpperCase();
  const gender = ['MEN', 'WOMEN', 'UNISEX'].includes(genderRaw) ? genderRaw : (fallback.gender || null);

  return {
    objective: fallback.objective,
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

async function listRecentAiGenerated() {
  const categories = await prisma.category.findMany({
    where: { aiGenerated: true },
    take: 20,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      level: true,
      path: true,
      gender: true,
      aiGenerated: true,
      active: true,
      hidden: true,
      featured: true,
      createdAt: true,
      updatedAt: true,
      parent: { select: { name: true } },
    },
  });

  return categories.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    parentId: item.parentId,
    parentName: item.parent?.name || null,
    level: item.level,
    path: item.path,
    gender: item.gender,
    aiGenerated: item.aiGenerated,
    active: item.active,
    hidden: item.hidden,
    featured: item.featured,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));
}

async function loadCurrentCategories(): Promise<CategoryRow[]> {
  return prisma.category.findMany({
    orderBy: [{ level: 'asc' }, { order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      parentId: true,
      level: true,
      path: true,
      active: true,
      hidden: true,
      featured: true,
      aiGenerated: true,
      gender: true,
    },
  });
}

async function buildPlan(objective: string, categories: CategoryRow[]) {
  const fallback = deterministicPlan(objective, categories);

  if (!aiTextConfigured()) {
    return {
      configured: false,
      plan: fallback,
    };
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
    throw new Error(ai.error || 'AI taxonomy planning failed');
  }

  return {
    configured: true,
    plan: normalizePlan(ai.json || {}, fallback, categories),
  };
}

async function createPlannedCategory(plan: TaxonomyPlan, categories: CategoryRow[]) {
  const name = titleCase(String(plan?.name || '').trim()).slice(0, 80);
  if (!name) throw new Error('Planned category name missing');

  const parent = resolveParent(plan, categories, null);
  const baseSlug = slugify(String(plan?.slug || name));
  let slug = baseSlug;

  if (parent?.slug) {
    slug = `${parent.slug}-${baseSlug}`;
  }

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    throw new Error(`Slug ${slug} already exists`);
  }

  const level = parent?.level ? parent.level + 1 : 1;
  if (level > 3) {
    throw new Error('Max depth is 3 levels');
  }

  const parentPath = parent?.path || parent?.slug || '';
  const path = parentPath ? `${parentPath}/${baseSlug}` : baseSlug;

  const created = await prisma.category.create({
    data: {
      slug,
      name,
      parentId: parent?.id || null,
      level,
      path,
      gender: normalizeGender(plan?.gender),
      active: true,
      hidden: false,
      featured: false,
      aiGenerated: true,
      order: 999,
      seoTitle: String(plan?.seoTitle || '').trim() || null,
      seoDesc: String(plan?.seoDescription || '').trim() || null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      level: true,
      path: true,
      gender: true,
      aiGenerated: true,
      active: true,
      hidden: true,
      featured: true,
      createdAt: true,
      updatedAt: true,
      parent: { select: { name: true } },
    },
  });

  return {
    id: created.id,
    objective: plan.objective,
    name: created.name,
    slug: created.slug,
    parentId: created.parentId,
    parentName: created.parent?.name || null,
    level: created.level,
    path: created.path,
    gender: created.gender,
    aiGenerated: created.aiGenerated,
    active: created.active,
    hidden: created.hidden,
    featured: created.featured,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const recent = await listRecentAiGenerated();
    return NextResponse.json({
      ok: true,
      configured: aiTextConfigured(),
      recent,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not load taxonomy AI history' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const body = await request.json().catch(() => ({}));
  const mode = String(body?.mode || 'plan').trim().toLowerCase();

  if (mode === 'create') {
    if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Only ADMIN or SUPER_ADMIN can create taxonomy categories.' }, { status: 401 });
    }
  } else {
    if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    if (mode === 'create') {
      const items = Array.isArray(body?.items) ? body.items : [];
      const currentCategories = await loadCurrentCategories();
      const created: any[] = [];
      const failed: any[] = [];

      for (let i = 0; i < items.length && i < 8; i++) {
        const item = items[i] || {};
        try {
          const objective = String(item?.objective || '').trim();
          const plan = item?.plan as TaxonomyPlan;
          const fallback = deterministicPlan(objective || String(plan?.name || 'New category'), currentCategories);
          const candidate: TaxonomyPlan = {
            ...fallback,
            ...plan,
            objective: objective || String(plan?.objective || fallback.objective || '').trim(),
          };

          const createdItem = await createPlannedCategory(candidate, currentCategories);
          created.push(createdItem);
          currentCategories.push({
            id: createdItem.id,
            slug: createdItem.slug,
            name: createdItem.name,
            parentId: createdItem.parentId,
            level: createdItem.level,
            path: createdItem.path,
            active: createdItem.active,
            hidden: createdItem.hidden,
            featured: createdItem.featured,
            aiGenerated: createdItem.aiGenerated,
            gender: createdItem.gender,
          });
        } catch (e: any) {
          failed.push({
            index: i,
            objective: String(item?.objective || item?.plan?.objective || '').trim(),
            error: e?.message || 'Creation failed',
          });
        }
      }

      const recent = await listRecentAiGenerated();

      return NextResponse.json({
        ok: true,
        configured: aiTextConfigured(),
        created,
        failed,
        recent,
      });
    }

    const items = Array.isArray(body?.items) ? body.items : [];
    const categories = Array.isArray(body?.categories) && body.categories.length > 0 ? body.categories as CategoryRow[] : await loadCurrentCategories();

    const objectives = items
      .map((item: any) => String(item?.objective || '').trim())
      .filter(Boolean)
      .filter((item: string) => item.length >= 5)
      .slice(0, 8);

    if (objectives.length === 0) {
      return NextResponse.json({ error: 'Provide 1-8 valid objectives.' }, { status: 400 });
    }

    const plans: TaxonomyPlan[] = [];
    const failed: any[] = [];
    let configured = false;

    for (let i = 0; i < objectives.length; i++) {
      const objective = objectives[i];
      try {
        const result = await buildPlan(objective, categories);
        if (result.configured) configured = true;
        plans.push(result.plan);
      } catch (e: any) {
        failed.push({
          index: i,
          objective,
          error: e?.message || 'Planning failed',
        });
      }
    }

    const recent = await listRecentAiGenerated();

    return NextResponse.json({
      ok: true,
      configured,
      plans,
      failed,
      recent,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Taxonomy AI batch failed' }, { status: 500 });
  }
}