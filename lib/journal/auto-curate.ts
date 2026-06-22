// lib/journal/auto-curate.ts
// Weekly journal generator. Picks a rotating seed, drafts a story via OpenAI,
// generates a cover image via FAL, persists a JournalDraft row, and returns it.

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { openaiChat, aiTextConfigured } from '@/lib/ai';

// Themes rotate week to week. We avoid repeating the same theme two weeks
// in a row by checking JournalSeedLog. Each theme has a distinct angle so the
// journal feels editorially varied.
type Theme =
  | 'artisan-spotlight'      // a maker / cluster profile
  | 'craft-technique'        // deep dive on a technique (e.g. dobby weave)
  | 'product-spotlight'      // pick a real product, write its origin story
  | 'regional-dispatch'      // a place / region report
  | 'material-meditation'    // study of a single material (khadi, silver, terracotta)
  | 'founder-letter';        // Nidhi's monthly-ish letter to the community

const ALL_THEMES: Theme[] = [
  'artisan-spotlight',
  'craft-technique',
  'product-spotlight',
  'regional-dispatch',
  'material-meditation',
  'founder-letter',
];

export interface CuratedDraft {
  draftId: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImage: string | null;
  approvalToken: string;
  theme: Theme;
  seedRef: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

async function pickTheme(): Promise<Theme> {
  // Look at the last 4 themes used; prefer something we haven't used recently.
  const recent = await prisma.journalSeedLog.findMany({
    orderBy: { usedAt: 'desc' },
    take: 4,
    select: { theme: true },
  });
  const recentSet = new Set(recent.map(r => r.theme));
  const fresh = ALL_THEMES.filter(t => !recentSet.has(t));
  if (fresh.length > 0) {
    return fresh[Math.floor(Math.random() * fresh.length)];
  }
  return ALL_THEMES[Math.floor(Math.random() * ALL_THEMES.length)];
}

async function pickSeedRef(theme: Theme): Promise<{ ref: string | null; brief: string }> {
  // For themes that target a real entity, pick one at random from the DB.
  // For abstract themes (founder-letter, material-meditation) we don't bind to a row.
  switch (theme) {
    case 'product-spotlight': {
      const products = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, slug: true, name: true, craft: true, region: true, artisanName: true, story: true },
        take: 50,
      });
      if (products.length === 0) return { ref: null, brief: 'No active products yet — write a general welcome to the catalogue.' };
      const p = products[Math.floor(Math.random() * products.length)];
      return {
        ref: p.slug,
        brief: `Product: ${p.name}. Craft: ${p.craft || 'unknown'}. Region: ${p.region || 'unknown'}. Artisan: ${p.artisanName || 'unknown'}. Existing notes: ${p.story?.slice(0, 200) || 'none'}.`,
      };
    }
    case 'artisan-spotlight': {
      const products = await prisma.product.findMany({
        where: { status: 'ACTIVE', artisanName: { not: null } },
        select: { artisanName: true, region: true, craft: true, cluster: true },
        distinct: ['artisanName'],
        take: 30,
      });
      if (products.length === 0) return { ref: null, brief: 'Write about a representative artisan archetype — a master weaver in their workshop at dawn.' };
      const p = products[Math.floor(Math.random() * products.length)];
      return {
        ref: p.artisanName,
        brief: `Artisan: ${p.artisanName}. Region: ${p.region || 'unknown'}. Craft: ${p.craft || 'unknown'}. Cluster: ${p.cluster || 'unknown'}.`,
      };
    }
    case 'craft-technique': {
      const crafts = await prisma.product.findMany({
        where: { status: 'ACTIVE', craft: { not: null } },
        select: { craft: true },
        distinct: ['craft'],
        take: 30,
      });
      if (crafts.length === 0) return { ref: null, brief: 'Write about jamdani weaving — a deep dive on the loom and the float-weft method.' };
      const c = crafts[Math.floor(Math.random() * crafts.length)];
      return { ref: c.craft, brief: `Craft technique: ${c.craft}. Explore loom, hand-movements, training years, and the moment a master "feels" the cloth.` };
    }
    case 'regional-dispatch': {
      const regions = await prisma.product.findMany({
        where: { status: 'ACTIVE', region: { not: null } },
        select: { region: true },
        distinct: ['region'],
        take: 30,
      });
      if (regions.length === 0) return { ref: null, brief: 'Dispatch from Varanasi — the river, the looms, the after-dusk silence.' };
      const r = regions[Math.floor(Math.random() * regions.length)];
      return { ref: r.region, brief: `Region: ${r.region}. A dispatch from there — landscape, materials in the air, sounds of the workshop streets, food, weather.` };
    }
    case 'material-meditation': {
      const materials = ['khadi cotton', 'mulberry silk', 'pure silver 92.5', 'lac-resin', 'terracotta clay', 'pashmina wool', 'mango wood', 'banana fibre'];
      const m = materials[Math.floor(Math.random() * materials.length)];
      return { ref: m, brief: `Material: ${m}. A short meditation — origin, hand-feel, how artisans test it, and why it lasts.` };
    }
    case 'founder-letter':
      return { ref: 'nidhi', brief: 'A short letter from Nidhi, founder of NEEJEE, to the reader. Talk about a recent visit to a maker, a new product, or a small ritual at the atelier.' };
  }
}

function generateApprovalToken(): string {
  // 32 bytes -> 64 hex chars. Sufficiently unguessable for one-click magic links.
  return randomBytes(32).toString('hex');
}

async function generateCoverImage(prompt: string): Promise<string | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  const FAL_BASE = 'https://fal.run';
  try {
    const submitRes = await fetch(`${FAL_BASE}/fal-ai/flux/schnell`, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_size: 'landscape_16_9',
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: false,
      }),
    });
    if (!submitRes.ok) return null;
    const submitData: any = await submitRes.json();
    // flux/schnell on fal.run returns the images directly (sync), but if it
    // falls back to queue we tolerate both shapes.
    if (submitData?.images?.[0]?.url) return submitData.images[0].url;
    const requestId: string | undefined = submitData?.request_id;
    if (!requestId) return null;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      const sRes = await fetch(`${FAL_BASE}/fal-ai/flux/schnell/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${key}` },
      });
      if (!sRes.ok) continue;
      const sJson: any = await sRes.json();
      if (sJson?.status === 'COMPLETED') {
        const rRes = await fetch(sJson.response_url || `${FAL_BASE}/fal-ai/flux/schnell/requests/${requestId}`, {
          headers: { Authorization: `Key ${key}` },
        });
        const rJson: any = await rRes.json();
        return rJson?.images?.[0]?.url || null;
      }
      if (sJson?.status === 'FAILED' || sJson?.status === 'CANCELED') return null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entrypoint

export interface CurateOpts {
  forceTheme?: Theme;
  createdByCron?: boolean;
}

export async function curateWeeklyJournal(opts: CurateOpts = {}): Promise<CuratedDraft> {
  if (!aiTextConfigured()) {
    throw new Error('OPENAI_API_KEY not configured — cannot draft journals');
  }

  const theme = opts.forceTheme || (await pickTheme());
  const { ref: seedRef, brief } = await pickSeedRef(theme);

  // ── 1. Draft text via OpenAI ───────────────────────────────────────────────
  const systemPrompt = [
    'You are the Editorial Voice of NEEJEE — a slow-luxury Indian artisanal atelier.',
    'Brand pillars: quiet reverence, named places, named hands, tactile detail, no exclamation marks.',
    'Hard rules:',
    '  • Every journal must mention Nidhi (the founder) by name once, naturally.',
    '  • No salesy language. No "shop now". No emojis. No exclamation marks.',
    '  • Use specific Indian place names and craft terms where the brief gives them.',
    '  • Title: 5-9 words, evocative, no clickbait.',
    '  • Excerpt: 30-50 words, one or two sentences, invites the reader in.',
    '  • Body: 320-450 words, 3-5 paragraphs, plain text with blank lines between paragraphs.',
    '  • coverImagePrompt: a 40-70 word prompt for a flux/schnell image generator. Describe a quiet, editorial photograph; no models facing camera; muted ivory/madder/indigo palette; natural light; no text.',
    '  • tags: 3-5 short lowercase tags (e.g. "banarasi", "weaving", "varanasi").',
    'Return strictly valid JSON with keys: title, excerpt, body, tags (string array), coverImagePrompt.',
  ].join('\n');

  const userMessage = [
    `This week's theme: ${theme}`,
    `Brief: ${brief}`,
    'Compose the journal entry now. Remember to mention Nidhi once, naturally.',
  ].join('\n\n');

  const res = await openaiChat({
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    model: 'gpt-4o-mini',
    temperature: 0.85,
    jsonMode: true,
  });

  if (!res.ok || !res.json) {
    throw new Error(`OpenAI draft failed: ${res.error || 'no JSON returned'}`);
  }

  const j = res.json as any;
  const title = String(j.title || '').trim() || 'Untitled Dispatch';
  const excerpt = j.excerpt ? String(j.excerpt).trim() : null;
  const body = String(j.body || '').trim();
  const tags = Array.isArray(j.tags) ? j.tags.map((t: any) => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 8) : [];
  const coverImagePrompt = j.coverImagePrompt ? String(j.coverImagePrompt).trim() : null;

  if (!body) throw new Error('OpenAI returned empty body');

  // Soft guard: ensure "Nidhi" appears. If not, inject a small line.
  const finalBody = /\bNidhi\b/i.test(body)
    ? body
    : `${body}\n\nNidhi sends this dispatch with her thanks.`;

  // ── 2. Cover image via FAL (best-effort; missing image does not block) ────
  let coverImage: string | null = null;
  if (coverImagePrompt) {
    coverImage = await generateCoverImage(coverImagePrompt);
  }

  // ── 3. Persist draft ──────────────────────────────────────────────────────
  const approvalToken = generateApprovalToken();
  const draft = await prisma.journalDraft.create({
    data: {
      title,
      excerpt,
      body: finalBody,
      coverImage,
      coverImagePrompt,
      tags,
      seedTheme: theme,
      seedRef: seedRef || null,
      status: 'PENDING_REVIEW',
      approvalToken,
      createdByCron: !!opts.createdByCron,
    },
  });

  // ── 4. Log the seed so next week doesn't repeat ───────────────────────────
  await prisma.journalSeedLog.create({
    data: { theme, seedRef: seedRef || null, draftId: draft.id },
  });

  return {
    draftId: draft.id,
    title,
    excerpt,
    body: finalBody,
    coverImage,
    approvalToken,
    theme,
    seedRef,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish helper: copy approved draft into CmsPage and archive the oldest.

const MAX_PUBLISHED_JOURNALS = 12;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function publishDraftToJournal(draftId: string, reviewerUserId: string | null): Promise<{ pageId: string; slug: string }> {
  const draft = await prisma.journalDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error('Draft not found');
  if (draft.status === 'PUBLISHED' && draft.publishedPageId) {
    const existing = await prisma.cmsPage.findUnique({ where: { id: draft.publishedPageId } });
    if (existing) return { pageId: existing.id, slug: existing.slug };
  }

  // Generate a unique slug (suffix with -2, -3 if needed)
  let baseSlug = `journal-${slugify(draft.title)}` || `journal-${draft.id.slice(0, 6)}`;
  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.cmsPage.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
    if (suffix > 50) { slug = `${baseSlug}-${Date.now()}`; break; }
  }

  // Build CmsPage sections — a single journalEntry section, mirroring the
  // shape used elsewhere in the codebase.
  const sections = [
    {
      type: 'journalEntry',
      data: {
        title: draft.title,
        author: 'Nidhi',
        date: new Date().toISOString().slice(0, 10),
        excerpt: draft.excerpt || '',
        body: draft.body,
        heroImage: draft.coverImage || '',
      },
    },
  ];

  const page = await prisma.cmsPage.create({
    data: {
      slug,
      title: draft.title,
      template: 'journal',
      sections: sections as any,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      pageType: 'journal',
      tags: draft.tags,
      featured: false,
      excerpt: draft.excerpt,
      coverImage: draft.coverImage,
      author: 'Nidhi',
      seoTitle: draft.title,
      seoDesc: draft.excerpt,
      ogImage: draft.coverImage,
    },
  });

  await prisma.journalDraft.update({
    where: { id: draft.id },
    data: {
      status: 'PUBLISHED',
      publishedPageId: page.id,
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
    },
  });

  // Archive the oldest beyond the cap (keep 12 newest, archive the rest).
  const allPublished = await prisma.cmsPage.findMany({
    where: { pageType: 'journal', status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true },
  });
  if (allPublished.length > MAX_PUBLISHED_JOURNALS) {
    const toArchive = allPublished.slice(MAX_PUBLISHED_JOURNALS).map(p => p.id);
    await prisma.cmsPage.updateMany({
      where: { id: { in: toArchive } },
      data: { status: 'ARCHIVED' },
    });
  }

  return { pageId: page.id, slug };
}

export async function rejectDraft(draftId: string, reviewerUserId: string | null, note: string): Promise<void> {
  await prisma.journalDraft.update({
    where: { id: draftId },
    data: {
      status: 'REJECTED',
      reviewerNote: note || null,
      reviewedByUserId: reviewerUserId,
      reviewedAt: new Date(),
    },
  });
}
