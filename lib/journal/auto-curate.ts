// Weekly journal generator. Picks a rotating seed, drafts a story via OpenAI,
// generates a cover image via FAL (unless a manual cover is supplied),
// persists a JournalDraft row, and returns it.

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { openaiChat, aiTextConfigured } from '@/lib/ai';

type Theme =
  | 'artisan-spotlight'
  | 'craft-technique'
  | 'product-spotlight'
  | 'regional-dispatch'
  | 'material-meditation'
  | 'founder-letter';

const ALL_THEMES: Theme[] = [
  'artisan-spotlight',
  'craft-technique',
  'product-spotlight',
  'regional-dispatch',
  'material-meditation',
  'founder-letter',
];

export interface StoryImage {
  url: string;
  caption?: string | null;
  alt?: string | null;
}

export interface CuratedDraft {
  draftId: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverImage: string | null;
  approvalToken: string;
  theme: Theme;
  seedRef: string | null;
  storyImages: StoryImage[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function generateApprovalToken(): string {
  return randomBytes(32).toString('hex');
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStoryImages(value: unknown): StoryImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;

      const url = normalizeString(raw.url);
      if (!url) return null;

      const caption = normalizeString(raw.caption);
      const alt = normalizeString(raw.alt);

      return {
        url,
        ...(caption ? { caption } : {}),
        ...(alt ? { alt } : {}),
      } as StoryImage;
    })
    .filter(Boolean) as StoryImage[];
}

async function pickTheme(): Promise<Theme> {
  const recent = await prisma.journalSeedLog.findMany({
    orderBy: { usedAt: 'desc' },
    take: 4,
    select: { theme: true },
  });

  const recentSet = new Set(recent.map((r) => r.theme));
  const fresh = ALL_THEMES.filter((t) => !recentSet.has(t as string));

  if (fresh.length > 0) {
    return fresh[Math.floor(Math.random() * fresh.length)];
  }

  return ALL_THEMES[Math.floor(Math.random() * ALL_THEMES.length)];
}

async function pickSeedRef(theme: Theme): Promise<{ ref: string | null; brief: string }> {
  switch (theme) {
    case 'product-spotlight': {
      const products = await prisma.product.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          slug: true,
          name: true,
          craft: true,
          region: true,
          artisanName: true,
          story: true,
        },
        take: 50,
      });

      if (products.length === 0) {
        return {
          ref: null,
          brief: 'No active products yet — write a general welcome to the catalogue.',
        };
      }

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

      if (products.length === 0) {
        return {
          ref: null,
          brief: 'Write about a representative artisan archetype — a master weaver in their workshop at dawn.',
        };
      }

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

      if (crafts.length === 0) {
        return {
          ref: null,
          brief: 'Write about jamdani weaving — a deep dive on the loom and the float-weft method.',
        };
      }

      const c = crafts[Math.floor(Math.random() * crafts.length)];
      return {
        ref: c.craft,
        brief: `Craft technique: ${c.craft}. Explore loom, hand-movements, training years, and the moment a master "feels" the cloth.`,
      };
    }

    case 'regional-dispatch': {
      const regions = await prisma.product.findMany({
        where: { status: 'ACTIVE', region: { not: null } },
        select: { region: true },
        distinct: ['region'],
        take: 30,
      });

      if (regions.length === 0) {
        return {
          ref: null,
          brief: 'Dispatch from Varanasi — the river, the looms, the after-dusk silence.',
        };
      }

      const r = regions[Math.floor(Math.random() * regions.length)];
      return {
        ref: r.region,
        brief: `Region: ${r.region}. A dispatch from there — landscape, materials in the air, sounds of the workshop streets, food, weather.`,
      };
    }

    case 'material-meditation': {
      const materials = [
        'khadi cotton',
        'mulberry silk',
        'pure silver 92.5',
        'lac-resin',
        'terracotta clay',
        'pashmina wool',
        'mango wood',
        'banana fibre',
      ];
      const m = materials[Math.floor(Math.random() * materials.length)];
      return {
        ref: m,
        brief: `Material: ${m}. A short meditation — origin, hand-feel, how artisans test it, and why it lasts.`,
      };
    }

    case 'founder-letter':
      return {
        ref: 'nidhi',
        brief: 'A short letter from Nidhi, founder of NEEJEE, to the reader. Talk about a recent visit to a maker, a new product, or a small ritual at the atelier.',
      };
  }
}

async function generateCoverImage(prompt: string): Promise<string | null> {
  const key = process.env.FAL_KEY;
  if (!key) return null;

  const FAL_BASE = 'https://fal.run';

  try {
    const submitRes = await fetch(`${FAL_BASE}/fal-ai/flux/schnell`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
      },
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

    if (submitData?.images?.[0]?.url) {
      return submitData.images[0].url;
    }

    const requestId: string | undefined = submitData?.request_id;
    if (!requestId) return null;

    const deadline = Date.now() + 60_000;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));

      const sRes = await fetch(`${FAL_BASE}/fal-ai/flux/schnell/requests/${requestId}/status`, {
        headers: { Authorization: `Key ${key}` },
      });

      if (!sRes.ok) continue;

      const sJson: any = await sRes.json();

      if (sJson?.status === 'COMPLETED') {
        const rRes = await fetch(
          sJson.response_url || `${FAL_BASE}/fal-ai/flux/schnell/requests/${requestId}`,
          {
            headers: { Authorization: `Key ${key}` },
          }
        );

        const rJson: any = await rRes.json();
        return rJson?.images?.[0]?.url || null;
      }

      if (sJson?.status === 'FAILED' || sJson?.status === 'CANCELED') {
        return null;
      }
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
  coverImageUrl?: string | null;
  storyImages?: StoryImage[];
}

export async function curateWeeklyJournal(opts: CurateOpts = {}): Promise<CuratedDraft> {
  if (!aiTextConfigured()) {
    throw new Error('OPENAI_API_KEY not configured — cannot draft journals');
  }

  const theme = opts.forceTheme || (await pickTheme());
  const { ref: seedRef, brief } = await pickSeedRef(theme);

  const suppliedCoverImage = normalizeString(opts.coverImageUrl) || null;
  const suppliedStoryImages = normalizeStoryImages(opts.storyImages);

  const storyImageBrief =
    suppliedStoryImages.length > 0
      ? suppliedStoryImages
          .map((img, index) => {
            const caption = img.caption ? ` Caption: ${img.caption}.` : '';
            const alt = img.alt ? ` Alt: ${img.alt}.` : '';
            return `Image ${index + 1}: ${img.url}.${caption}${alt}`;
          })
          .join('\n')
      : '';

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
    '  • If story images are supplied, structure the body so it reads naturally alongside a short editorial photo essay.',
    '  • coverImagePrompt: a 40-70 word prompt for a flux/schnell image generator. Describe a quiet, editorial photograph; no models facing camera; muted ivory/madder/indigo palette; natural light; no text.',
    '  • tags: 3-5 short lowercase tags (e.g. "banarasi", "weaving", "varanasi").',
    'Return strictly valid JSON with keys: title, excerpt, body, tags (string array), coverImagePrompt.',
  ].join('\n');

  const userMessage = [
    `This week's theme: ${theme}`,
    `Brief: ${brief}`,
    suppliedCoverImage
      ? 'A manual cover image URL has been supplied and should be used instead of relying on generated cover art.'
      : '',
    storyImageBrief ? `Story images to include in the editorial sequencing:\n${storyImageBrief}` : '',
    'Compose the journal entry now. Remember to mention Nidhi once, naturally.',
  ]
    .filter(Boolean)
    .join('\n\n');

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
  const tags = Array.isArray(j.tags)
    ? j.tags
        .map((t: any) => String(t).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const coverImagePrompt = j.coverImagePrompt ? String(j.coverImagePrompt).trim() : null;

  if (!body) {
    throw new Error('OpenAI returned empty body');
  }

  const finalBody = /\bNidhi\b/i.test(body)
    ? body
    : `${body}\n\nNidhi sends this dispatch with her thanks.`;

  let coverImage: string | null = suppliedCoverImage;
  if (!coverImage && coverImagePrompt) {
    coverImage = await generateCoverImage(coverImagePrompt);
  }

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
      storyImages: suppliedStoryImages as any,
    },
  });

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
    storyImages: suppliedStoryImages,
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

export async function publishDraftToJournal(
  draftId: string,
  reviewerUserId: string | null
): Promise<{ pageId: string; slug: string }> {
  const draft = await prisma.journalDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error('Draft not found');

  if (draft.status === 'PUBLISHED' && draft.publishedPageId) {
    const existing = await prisma.cmsPage.findUnique({ where: { id: draft.publishedPageId } });
    if (existing) return { pageId: existing.id, slug: existing.slug };
  }

  let baseSlug = `journal-${slugify(draft.title)}` || `journal-${draft.id.slice(0, 6)}`;
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.cmsPage.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix++}`;
    if (suffix > 50) {
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  const storyImages = normalizeStoryImages(draft.storyImages);

  const sections = [
    {
      type: 'journalEntry',
      data: {
        title: draft.title,
        author: 'Nidhi',
        date: draft.createdAt.toISOString().slice(0, 10),
        excerpt: draft.excerpt || '',
        body: draft.body,
        heroImage: draft.coverImage || '',
        storyImages,
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

  const allPublished = await prisma.cmsPage.findMany({
    where: { pageType: 'journal', status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true },
  });

  if (allPublished.length > MAX_PUBLISHED_JOURNALS) {
    const toArchive = allPublished.slice(MAX_PUBLISHED_JOURNALS).map((p) => p.id);
    await prisma.cmsPage.updateMany({
      where: { id: { in: toArchive } },
      data: { status: 'ARCHIVED' },
    });
  }

  return { pageId: page.id, slug };
}

export async function rejectDraft(
  draftId: string,
  reviewerUserId: string | null,
  note: string
): Promise<void> {
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
