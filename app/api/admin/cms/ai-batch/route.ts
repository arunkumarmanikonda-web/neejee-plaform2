import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { aiTextConfigured, openaiChat } from '@/lib/ai';
import { SECTION_TYPES, defaultData, type SectionType } from '@/lib/cms-sections';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

type BatchItem = {
  brief: string;
  audience?: string;
  goal?: string;
};

const VALID_TYPES = new Set(SECTION_TYPES.map((s) => s.type));

function cuid(): string {
  return 'sec_' + Math.random().toString(36).slice(2, 12);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'untitled';
}

async function listRecentDrafts() {
  const pages = await prisma.cmsPage.findMany({
    take: 20,
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
      seoTitle: true,
      seoDesc: true,
    },
  });

  return pages.map((page) => ({
    ...page,
    updatedAt: page.updatedAt.toISOString(),
  }));
}

async function makeUniqueSlug(base: string) {
  let finalSlug = slugify(base);
  const exists = await prisma.cmsPage.findUnique({ where: { slug: finalSlug } });
  if (!exists) return finalSlug;

  for (let i = 2; i <= 50; i++) {
    const candidate = `${finalSlug}-${i}`;
    const collision = await prisma.cmsPage.findUnique({ where: { slug: candidate } });
    if (!collision) return candidate;
  }

  return `${finalSlug}-${Date.now()}`;
}

function fallbackScaffold(item: BatchItem) {
  const baseTitle = item.brief.trim().split(/\s+/).slice(0, 6).join(' ');
  return {
    title: baseTitle || 'New page',
    slug: slugify(item.brief).slice(0, 40),
    seoTitle: `${baseTitle || 'New page'} | Neejee`.slice(0, 60),
    seoDesc: `A Neejee page for ${item.brief.trim()}`.slice(0, 160),
    sections: [
      { id: cuid(), type: 'hero', data: defaultData('hero') },
      { id: cuid(), type: 'text', data: defaultData('text') },
      { id: cuid(), type: 'productCarousel', data: defaultData('productCarousel') },
      { id: cuid(), type: 'cta', data: defaultData('cta') },
    ],
  };
}

async function aiScaffold(item: BatchItem) {
  const system = `You are NEEJEE's CMS Page Architect.
NEEJEE is a personal Indian craft brand. Voice: quiet, reverent, sincere, never sales-y.
Brand pillar: "Found. Personal." Sensory, named, slow.
Avoid: "luxurious", "exquisite", "premium", "elegant", emojis, exclamation marks.
Prefer: specific places (Banaras, Kanchipuram), specific techniques (zari, tapchi, meenakari), real-feeling artisan names, Indian English, no marketing voice.

Given a brief from the content editor, scaffold a NEEJEE landing page as JSON.

Return STRICTLY this JSON shape (no markdown fence, no comments):
{
  "title": "<page title — 3-6 words>",
  "slug": "<lowercase-url-slug>",
  "seoTitle": "<50-60 char SEO title>",
  "seoDesc": "<150-160 char meta description>",
  "sections": [
    { "type": "hero" | "videoHero" | "text" | "quote" | "founderNote" | "journalEntry"
      | "splitSection" | "image" | "imageGrid" | "lookbook" | "productCarousel"
      | "featureGrid" | "testimonial" | "accordion" | "cta" | "marquee" | "divider",
      "data": { } }
  ]
}

Use 4-8 sections. Order them so the page tells a story: hook → who/why → proof → invitation.
For images, use empty string "" (editor uploads them later).
For productCarousel, source should be one of: "founder", "new", "sale".`;

  const userMsg = `Editor brief:
${item.brief}

Audience: ${item.audience || 'NEEJEE customers'}
Goal of page: ${item.goal || 'inform and invite'}

Scaffold the page now.`;

  const ai = await openaiChat({
    system,
    messages: [{ role: 'user', content: userMsg }],
    temperature: 0.75,
    jsonMode: true,
  });

  if (!ai.ok) {
    throw new Error(ai.error || 'AI generation failed');
  }

  const draft = ai.json || {};
  const sections = Array.isArray(draft.sections)
    ? draft.sections
        .filter((s: any) => s && typeof s.type === 'string' && VALID_TYPES.has(s.type as SectionType))
        .slice(0, 12)
        .map((s: any) => ({
          id: cuid(),
          type: s.type as SectionType,
          data: { ...defaultData(s.type as SectionType), ...(s.data || {}) },
        }))
    : [];

  return {
    title: typeof draft.title === 'string' ? draft.title.slice(0, 120) : item.brief.slice(0, 80),
    slug: slugify(draft.slug || draft.title || item.brief),
    seoTitle: typeof draft.seoTitle === 'string' ? draft.seoTitle.slice(0, 100) : '',
    seoDesc: typeof draft.seoDesc === 'string' ? draft.seoDesc.slice(0, 200) : '',
    sections: sections.length > 0 ? sections : fallbackScaffold(item).sections,
  };
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const recent = await listRecentDrafts();
    return NextResponse.json({
      ok: true,
      configured: aiTextConfigured(),
      recent,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const items = Array.isArray(body?.items) ? (body.items as BatchItem[]) : [];

    const cleaned = items
      .map((item) => ({
        brief: typeof item?.brief === 'string' ? item.brief.trim() : '',
        audience: typeof item?.audience === 'string' ? item.audience.trim() : 'NEEJEE customers',
        goal: typeof item?.goal === 'string' ? item.goal.trim() : 'inform and invite',
      }))
      .filter((item) => item.brief.length >= 5)
      .slice(0, 8);

    if (cleaned.length === 0) {
      return NextResponse.json({ error: 'Provide 1-8 valid items.' }, { status: 400 });
    }

    const configured = aiTextConfigured();
    const created: any[] = [];
    const failed: any[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const item = cleaned[i];
      try {
        const scaffold = configured ? await aiScaffold(item) : fallbackScaffold(item);
        const finalSlug = await makeUniqueSlug(scaffold.slug || item.brief);

        const page = await prisma.cmsPage.create({
          data: {
            title: scaffold.title || item.brief,
            slug: finalSlug,
            template: 'default',
            sections: Array.isArray(scaffold.sections) ? (scaffold.sections as any) : ([] as any),
            seoTitle: scaffold.seoTitle || null,
            seoDesc: scaffold.seoDesc || null,
            status: 'DRAFT',
          },
        });

        created.push({
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          configured,
          updatedAt: page.updatedAt.toISOString(),
        });
      } catch (e: any) {
        failed.push({
          index: i,
          brief: item.brief,
          audience: item.audience || 'NEEJEE customers',
          goal: item.goal || 'inform and invite',
          error: e?.message || 'Batch item failed',
        });
      }
    }

    const recent = await listRecentDrafts();

    return NextResponse.json({
      ok: true,
      configured,
      created,
      failed,
      recent,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}