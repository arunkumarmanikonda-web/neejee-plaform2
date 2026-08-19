// About page is CMS-driven (slug: about-page) with evidence-safe fallbacks.
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'About · NEEJEE',
  description: "Why NEEJEE exists: to make India's craft traditions easier to discover without losing the maker, place and process behind the piece.",
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AboutSections = {
  eyebrow: string;
  title: string;
  pullquote: string;
  attribution: string;
  paragraphs: string[];
  closingLine: string;
  stats: { label: string; value: string; note: string }[];
  ctaText: string;
  ctaUrl: string;
};

const DEFAULT_CONTENT: AboutSections = {
  eyebrow: 'ABOUT',
  title: 'Why we exist.',
  pullquote: 'The rarest things in India are rarely the hardest to make. They are simply the hardest to find.',
  attribution: 'Nidhi Chauhan, Founder',
  paragraphs: [
    'NEEJEE began with a question I could not answer for myself: where do I find the things I know India still makes, without losing the place, process and people that give those things meaning?',
    'Across India, extraordinary traditions continue in weaving, embroidery, metalwork, pottery, wood, fragrance, painting and many other forms. Yet online, the story of a piece can disappear behind a product tile long before a customer understands what made it worth finding.',
    'NEEJEE is being built as a quieter alternative. We want a product record to do more than sell: it should explain what is known about the craft, region, material and maker, distinguish verified detail from editorial storytelling, and give the customer enough context to choose with confidence.',
    'That means curation is not only aesthetic. It is also operational. Images must be approved, stock must be real, commercial terms must be clear, and provenance claims should be supported before they are published as fact.',
    'The catalogue will grow over time. The principle is meant to remain the same: find carefully, describe truthfully, and make the experience feel personal rather than endless.',
  ],
  closingLine: 'One place. One spotlight. A more considered way to discover India, piece by piece.',
  stats: [
    { label: 'FOUNDED', value: '2026', note: 'Built in India' },
    { label: 'CURATION', value: 'Founder-led', note: 'Publication is reviewed before a piece is surfaced' },
    { label: 'DISCLOSURE', value: 'Evidence-led', note: 'Specific claims belong only where the record supports them' },
  ],
  ctaText: 'Begin Finding',
  ctaUrl: '/',
};

async function getAboutContent(): Promise<AboutSections> {
  try {
    const page = await prisma.cmsPage.findUnique({
      where: { slug: 'about-page' },
      select: { status: true, sections: true },
    });
    if (!page || page.status !== 'PUBLISHED') return DEFAULT_CONTENT;
    const sections = Array.isArray(page.sections) ? page.sections : [];
    const merged: AboutSections = { ...DEFAULT_CONTENT, paragraphs: [...DEFAULT_CONTENT.paragraphs], stats: [...DEFAULT_CONTENT.stats] };

    for (const section of sections as any[]) {
      if (section?.type === 'hero' && section.data) {
        if (section.data.eyebrow) merged.eyebrow = section.data.eyebrow;
        if (section.data.title) merged.title = section.data.title;
        if (section.data.subtitle) merged.pullquote = section.data.subtitle;
      } else if (section?.type === 'quote' && section.data) {
        if (section.data.text) merged.pullquote = section.data.text;
        if (section.data.attribution) merged.attribution = section.data.attribution;
      } else if (section?.type === 'text' && section.data?.body) {
        const paragraphs = String(section.data.body).split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
        if (paragraphs.length > 0) merged.paragraphs = paragraphs;
      } else if (section?.type === 'cta' && section.data) {
        if (section.data.ctaText) merged.ctaText = section.data.ctaText;
        if (section.data.ctaUrl) merged.ctaUrl = section.data.ctaUrl;
      }
    }
    return merged;
  } catch {
    return DEFAULT_CONTENT;
  }
}

export default async function AboutPage() {
  const content = await getAboutContent();
  return (
    <>
      <Header />
      <main>
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-14 text-center">
          <p className="editorial-kicker">{content.eyebrow}</p>
          <h1 className="font-display text-5xl md:text-6xl text-kohl leading-tight mt-4">{content.title}</h1>
          <div className="ornament-rule justify-center mt-8"><span className="font-display italic text-mitti text-sm">FOUND. PERSONAL.</span></div>
          <p className="editorial-pullquote mt-12">&ldquo;{content.pullquote}&rdquo;</p>
          <p className="font-ui text-[9px] tracking-[0.2em] text-mitti mt-6">{content.attribution.toUpperCase()}</p>
        </section>

        <section className="max-w-3xl mx-auto px-6 py-10 font-display text-[17px] md:text-[18px] text-kohl/82 leading-[1.8] space-y-6">
          {content.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          {content.closingLine && <p className="font-display italic text-2xl text-mitti text-center pt-5">{content.closingLine}</p>}
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-5">
          {content.stats.map((stat) => (
            <div key={stat.label} className="paper-panel text-center p-8">
              <p className="editorial-kicker">{stat.label}</p>
              <p className="font-display text-[36px] text-kohl mt-3">{stat.value}</p>
              <p className="font-display italic text-mitti mt-3 text-[13px] leading-relaxed">{stat.note}</p>
            </div>
          ))}
        </section>

        <section className="max-w-2xl mx-auto px-6 pb-20 pt-4 text-center">
          <Link href={content.ctaUrl} className="btn-primary inline-block">{content.ctaText}</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
