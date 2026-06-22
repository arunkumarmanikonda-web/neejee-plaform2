// AI Page Scaffold endpoint — accepts a plain-English brief
// and returns a complete CMS page structure (title, slug, sections[]).
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { aiTextConfigured, openaiChat } from '@/lib/ai';
import { SECTION_TYPES, defaultData, type SectionType } from '@/lib/cms-sections';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 45;

const VALID_TYPES = new Set(SECTION_TYPES.map(s => s.type));

function cuid(): string {
  return 'sec_' + Math.random().toString(36).slice(2, 12);
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'untitled';
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { brief, audience, goal } = await request.json();
    if (!brief || typeof brief !== 'string' || brief.trim().length < 5) {
      return NextResponse.json({ error: 'Please describe the page you want (at least 5 characters).' }, { status: 400 });
    }

    if (!aiTextConfigured()) {
      // Graceful fallback — return a sensible default scaffold
      const fallback = {
        title: 'New page',
        slug: slugify(brief).slice(0, 40),
        sections: [
          { id: cuid(), type: 'hero', data: defaultData('hero') },
          { id: cuid(), type: 'text', data: defaultData('text') },
          { id: cuid(), type: 'productCarousel', data: defaultData('productCarousel') },
          { id: cuid(), type: 'cta', data: defaultData('cta') },
        ],
      };
      return NextResponse.json({ ok: true, configured: false, page: fallback, message: 'AI page generator returned a default scaffold. Add OPENAI_API_KEY for AI-drafted content.' });
    }

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
      "data": { /* fields for that section, see below */ } }
  ]
}

Use 4-8 sections. Order them so the page tells a story: hook → who/why → proof → invitation.
For images, use empty string "" (editor uploads them later).
For productCarousel, source should be one of: "founder", "new", "sale".

Field shapes per section type:
- hero: { eyebrow, title, subtitle, ctaText, ctaUrl, dark: true|false, image: "" }
- videoHero: { eyebrow, title, subtitle, ctaText, ctaUrl, videoUrl: "", poster: "" }
- text: { title, body, align: "left"|"center" }
- quote: { text, attribution }
- founderNote: { name: "Nidhi", title: "Founder, NEEJEE", body }
- journalEntry: { title, author: "Nidhi", date: "2026-01-01", excerpt, body, heroImage: "" }
- splitSection: { title, body, ctaText, ctaUrl, imagePosition: "left"|"right", image: "" }
- image: { url: "", alt, caption, aspect: "16:9" }
- imageGrid: { columns: 3, items: [{ url: "", alt }, ...] }
- lookbook: { title, layout: "asymmetric"|"grid"|"stacked", items: [{ url: "", caption }, ...] }
- productCarousel: { title, source: "founder"|"new"|"sale", limit: 6 }
- featureGrid: { title, columns: 3, items: [{ icon, title, body }, ...] (3 items) }
- testimonial: { text, author, location, rating: 5, photo: "" }
- accordion: { title, items: [{ question, answer }, ...] (4-6 items) }
- cta: { eyebrow, title, body, ctaText, ctaUrl }
- marquee: { text, speed: 30 }
- divider: { style: "madder" }`;

    const userMsg = `Editor brief:
${brief}

Audience: ${audience || 'NEEJEE customers'}
Goal of page: ${goal || 'inform and invite'}

Scaffold the page now.`;

    const ai = await openaiChat({
      system,
      messages: [{ role: 'user', content: userMsg }],
      temperature: 0.75,
      jsonMode: true,
    });

    if (!ai.ok) {
      return NextResponse.json({ error: ai.error || 'AI generation failed' }, { status: 500 });
    }

    const draft = ai.json || {};
    // Validate + sanitise sections
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

    const page = {
      title: typeof draft.title === 'string' ? draft.title.slice(0, 120) : 'New page',
      slug: slugify(draft.slug || draft.title || brief),
      seoTitle: typeof draft.seoTitle === 'string' ? draft.seoTitle.slice(0, 100) : '',
      seoDesc: typeof draft.seoDesc === 'string' ? draft.seoDesc.slice(0, 200) : '',
      sections,
    };

    return NextResponse.json({ ok: true, configured: true, page });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
