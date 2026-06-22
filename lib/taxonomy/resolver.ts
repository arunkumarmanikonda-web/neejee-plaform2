/**
 * AI-Driven Taxonomy Resolver — v26.1.8
 *
 * Single source of truth for resolving a product to a leaf category.
 *
 * Behavior:
 *   1. Try exact slug / path match in DB.
 *   2. Try fuzzy match (slugified name contains).
 *   3. If still no leaf match and AI is configured, call OpenAI to:
 *      - decide the best (main, sub, leaf) triple
 *      - if leaf is missing under that sub, auto-create it as an AI-generated category
 *      - if sub is missing under that main, auto-create it too
 *      - in previewCreate mode, return virtual placeholders without writing to the DB
 *   4. Returns { categoryId, path, level, created: [...new slugs...] }
 *
 * Used by:
 *   - admin/seller product create/edit (single searchable picker)
 *   - bulk Excel import
 *   - product-migration job (existing products without a leaf category)
 */

import { prisma } from '@/lib/prisma';
import { aiTextConfigured, openaiChat } from '@/lib/ai';

export type ResolveInput = {
  query?: string | null;
  product?: {
    name?: string | null;
    description?: string | null;
    craft?: string | null;
    region?: string | null;
    material?: string | null;
    tags?: string[] | null;
  };
  allowAi?: boolean;
  /** When false, do not create new categories (dry-run / preview). */
  allowCreate?: boolean;
  /**
   * v26.1.8 — when true (and allowCreate is false), the resolver returns a
   * "virtual" leaf showing what WOULD be created, so dry-run migration
   * previews can display the full plan including AI-invented sub/leaf names.
   * No database writes happen.
   */
  previewCreate?: boolean;
};

export type ResolveResult = {
  ok: boolean;
  categoryId?: string;
  slug?: string;
  path?: string;
  name?: string;
  level?: number;
  breadcrumb?: { id: string; slug: string; name: string; level: number }[];
  created?: string[];
  matchedBy?: 'exact-slug' | 'exact-path' | 'fuzzy' | 'ai' | 'ai-created';
  error?: string;
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

export async function searchCategories(q: string, limit = 25) {
  const query = (q || '').trim();
  if (!query) {
    const leaves = await prisma.category.findMany({
      where: { active: true, hidden: false, level: 3 },
      include: { parent: { include: { parent: true } } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      take: limit,
    });
    return leaves.map(toPickerRow);
  }
  const matches = await prisma.category.findMany({
    where: {
      active: true,
      hidden: false,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { slug: { contains: slugify(query), mode: 'insensitive' } },
      ],
    },
    include: {
      parent: { include: { parent: true } },
      children: {
        where: { active: true, hidden: false, level: 3 },
        include: { parent: { include: { parent: true } } },
        take: 50,
      },
    },
    take: 50,
  });
  const rows: ReturnType<typeof toPickerRow>[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    if (m.level === 3) {
      if (!seen.has(m.id)) { seen.add(m.id); rows.push(toPickerRow(m)); }
    } else if (m.level === 2) {
      for (const leaf of m.children) {
        if (!seen.has(leaf.id)) { seen.add(leaf.id); rows.push(toPickerRow(leaf)); }
      }
      if (!seen.has(m.id)) { seen.add(m.id); rows.push(toPickerRow(m)); }
    } else if (m.level === 1) {
      if (!seen.has(m.id)) { seen.add(m.id); rows.push(toPickerRow(m)); }
    }
  }
  return rows.slice(0, limit);
}

function toPickerRow(c: any) {
  const chain: { id: string; slug: string; name: string; level: number }[] = [];
  let cur: any = c;
  while (cur) {
    chain.unshift({ id: cur.id, slug: cur.slug, name: cur.name, level: cur.level ?? 1 });
    cur = cur.parent || null;
  }
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    level: c.level ?? 1,
    path: c.path || chain.map((x) => x.slug).join('/'),
    breadcrumb: chain,
    label: chain.map((x) => x.name).join(' / '),
  };
}

export async function resolveCategory(input: ResolveInput): Promise<ResolveResult> {
  const q = (input.query || '').trim();
  const created: string[] = [];

  if (q) {
    const direct = await prisma.category.findFirst({
      where: {
        active: true,
        OR: [{ id: q }, { slug: slugify(q) }, { path: q }, { path: slugify(q) }],
      },
      include: { parent: { include: { parent: true } } },
    });
    if (direct) return finalize(direct, 'exact-slug', created);

    const fuzzy = await prisma.category.findMany({
      where: {
        active: true,
        hidden: false,
        name: { equals: q, mode: 'insensitive' },
      },
      include: { parent: { include: { parent: true } } },
      take: 2,
    });
    if (fuzzy.length === 1) return finalize(fuzzy[0], 'fuzzy', created);
  }

  if (!input.allowAi || !aiTextConfigured()) {
    return { ok: false, error: q ? `No category match for "${q}"` : 'Empty query' };
  }

  const tree = await getTreeSnapshot();
  const ctx = input.product || {};
  const prompt = `You are NEEJEE's taxonomy expert. Given a product, pick the BEST (main, sub, leaf) triple from the taxonomy.
If the appropriate leaf does not exist under the chosen sub, INVENT a sensible new leaf name.
If the appropriate sub does not exist under the chosen main, INVENT it.
Never invent a new main category — main categories are fixed: ${tree.mains.map((m: any) => m.name).join(', ')}.
Leaf names must be 1–3 words, title-cased, and reflect a real Indian craft/material/style where applicable.
Return STRICT JSON only.

PRODUCT CONTEXT:
${JSON.stringify({
  query: q || null,
  name: ctx.name || null,
  description: (ctx.description || '').slice(0, 600),
  craft: ctx.craft || null,
  region: ctx.region || null,
  material: ctx.material || null,
  tags: ctx.tags || null,
}, null, 2)}

EXISTING TAXONOMY (main → sub → [leaves]):
${formatTree(tree)}

Respond with JSON:
{
  "main": "<existing main slug>",
  "sub": "<existing sub slug OR new sub name>",
  "subIsNew": <boolean>,
  "leaf": "<existing leaf slug OR new leaf name>",
  "leafIsNew": <boolean>,
  "confidence": <0..1>,
  "reason": "<short>"
}`;

  const ai = await openaiChat({
    system: 'You map products to a fixed 3-level retail taxonomy. Respond with strict JSON.',
    messages: [{ role: 'user', content: prompt }],
    jsonMode: true,
    temperature: 0.2,
  });
  if (!ai.ok || !ai.json) return { ok: false, error: ai.error || 'AI did not respond' };

  const decision = ai.json as {
    main: string; sub: string; subIsNew?: boolean;
    leaf: string; leafIsNew?: boolean; confidence?: number;
  };

  const main = tree.mains.find(
    (m: any) => m.slug === slugify(decision.main) || m.name.toLowerCase() === decision.main.toLowerCase(),
  );
  if (!main) return { ok: false, error: `AI returned unknown main "${decision.main}"` };

  // Resolve / create / preview sub
  let sub = main.children.find(
    (s: any) => s.slug === slugify(decision.sub) || s.name.toLowerCase() === decision.sub.toLowerCase(),
  );
  let subIsVirtual = false;
  if (!sub) {
    if (input.allowCreate) {
      sub = await createCategoryChild({ parent: main, name: titleCase(decision.sub), level: 2, aiGenerated: true });
      created.push(sub.slug);
    } else if (input.previewCreate) {
      const subName = titleCase(decision.sub);
      const subSlug = slugify(subName);
      sub = {
        id: `__preview_${subSlug}`,
        slug: subSlug,
        name: subName,
        parentId: main.id,
        level: 2,
        path: `${main.path || main.slug}/${subSlug}`,
        children: [] as any[],
      } as any;
      created.push(`${subSlug} (preview)`);
      subIsVirtual = true;
    } else {
      return { ok: false, error: `Sub "${decision.sub}" not found (dry-run)` };
    }
  }

  // Resolve / create / preview leaf
  let leaf = subIsVirtual
    ? undefined
    : sub!.children?.find(
        (l: any) => l.slug === slugify(decision.leaf) || l.name.toLowerCase() === decision.leaf.toLowerCase(),
      );
  let leafIsVirtual = false;
  if (!leaf) {
    if (input.allowCreate) {
      leaf = await createCategoryChild({ parent: sub, name: titleCase(decision.leaf), level: 3, aiGenerated: true });
      created.push(leaf.slug);
    } else if (input.previewCreate) {
      const leafName = titleCase(decision.leaf);
      const leafSlug = slugify(leafName);
      leaf = {
        id: `__preview_${leafSlug}`,
        slug: leafSlug,
        name: leafName,
        parentId: sub!.id,
        level: 3,
        path: `${sub!.path || sub!.slug}/${leafSlug}`,
      } as any;
      created.push(`${leafSlug} (preview)`);
      leafIsVirtual = true;
    } else {
      const subWithAncestors = await prisma.category.findUnique({
        where: { id: sub!.id },
        include: { parent: { include: { parent: true } } },
      });
      return finalize(subWithAncestors!, 'ai', created);
    }
  }

  if (leafIsVirtual || subIsVirtual) {
    const chain: { id: string; slug: string; name: string; level: number }[] = [
      { id: main.id, slug: main.slug, name: main.name, level: 1 },
      { id: sub!.id, slug: sub!.slug, name: sub!.name, level: 2 },
      { id: leaf!.id, slug: leaf!.slug, name: leaf!.name, level: 3 },
    ];
    return {
      ok: true,
      categoryId: leaf!.id,
      slug: leaf!.slug,
      name: leaf!.name,
      path: leaf!.path,
      level: 3,
      breadcrumb: chain,
      created,
      matchedBy: 'ai-created',
    };
  }

  const leafFull = await prisma.category.findUnique({
    where: { id: leaf!.id },
    include: { parent: { include: { parent: true } } },
  });
  return finalize(leafFull!, created.length ? 'ai-created' : 'ai', created);
}

function finalize(c: any, matchedBy: ResolveResult['matchedBy'], created: string[]): ResolveResult {
  const chain: { id: string; slug: string; name: string; level: number }[] = [];
  let cur: any = c;
  while (cur) {
    chain.unshift({ id: cur.id, slug: cur.slug, name: cur.name, level: cur.level ?? 1 });
    cur = cur.parent || null;
  }
  return {
    ok: true,
    categoryId: c.id,
    slug: c.slug,
    name: c.name,
    path: c.path || chain.map((x) => x.slug).join('/'),
    level: c.level ?? chain.length,
    breadcrumb: chain,
    created,
    matchedBy,
  };
}

async function createCategoryChild(args: {
  parent: any;
  name: string;
  level: 2 | 3;
  aiGenerated: boolean;
}) {
  const baseSlug = slugify(args.name);
  let slug = baseSlug;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.category.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${n++}`;
  }
  const path = `${args.parent.path || args.parent.slug}/${slug}`;
  const created = await prisma.category.create({
    data: {
      slug,
      name: args.name,
      parentId: args.parent.id,
      level: args.level,
      path,
      active: true,
      hidden: false,
      aiGenerated: args.aiGenerated,
      order: 999,
    },
    include: { parent: { include: { parent: true } } },
  });
  return created as any;
}

function titleCase(s: string) {
  return s
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

let _treeCache: { ts: number; data: any } | null = null;
async function getTreeSnapshot() {
  const now = Date.now();
  if (_treeCache && now - _treeCache.ts < 60_000) return _treeCache.data;
  const mains = await prisma.category.findMany({
    where: { active: true, hidden: false, level: 1 },
    orderBy: { order: 'asc' },
    include: {
      children: {
        where: { active: true, hidden: false, level: 2 },
        orderBy: { order: 'asc' },
        include: {
          children: {
            where: { active: true, hidden: false, level: 3 },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });
  const data = { mains };
  _treeCache = { ts: now, data };
  return data;
}

export function invalidateTreeCache() {
  _treeCache = null;
}

function formatTree(tree: any) {
  return tree.mains
    .map((m: any) => {
      const subs = m.children
        .map((s: any) => {
          const leaves = s.children.map((l: any) => l.name).join(', ');
          return `  - ${s.name} (${s.slug}): [${leaves}]`;
        })
        .join('\n');
      return `${m.name} (${m.slug}):\n${subs}`;
    })
    .join('\n\n');
}

/**
 * Generate a SKU based on resolved category path.
 * Format: NEE-<MAIN3>-<SUB3>-<LEAF3>-<COUNTER4>  (e.g. NEE-WOM-SAR-BAN-0001)
 */
export async function generateSkuFor(categoryId: string) {
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { parent: { include: { parent: true } } },
  });
  if (!cat) return `NEE-GEN-${Date.now().toString().slice(-6)}`;
  const chain: any[] = [];
  let cur: any = cat;
  while (cur) { chain.unshift(cur); cur = cur.parent; }
  const code = (s: string) =>
    s.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const parts = chain.slice(0, 3).map((c) => code(c.name));
  while (parts.length < 3) parts.push('GEN');
  const prefix = `NEE-${parts.join('-')}`;
  const count = await prisma.product.count({ where: { sku: { startsWith: prefix } } });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}