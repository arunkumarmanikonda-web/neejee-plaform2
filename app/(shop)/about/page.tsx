// v23.40.26.0.2 — About page is now CMS-driven.
// Edit at /admin/cms (slug: about-page). Falls back to default hardcoded content if CMS row is missing or unpublished.
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { prisma } from '@/lib/prisma';

export const metadata = {
  title: 'About · NEEJEE',
  description: 'NEEJEE is the place built for India\'s quiet, generational craft. Weavers, potters, carpenters, metalsmiths, perfumers and the hands behind every piece. Founded by Nidhi Chauhan.',
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
    'NEEJEE began with a question I could not answer for myself: where do I buy the things I know India makes?',
    'In the north, I knew there was a Banarasi being woven on a pit-loom in Varanasi, a Chikankari shadow-stitch being whispered onto white muslin in Lucknow, a Zardozi being couched in gold next to it. A Phulkari being threaded in vintage pink in Amritsar, a Jutti being stitched in Patiala. A Pashmina being spun from changthangi goat-down in Kashmir, a Kani shawl growing one motif a day on a loom, a Sozni needle following a paisley for three winters.',
    'In the heart of the country, a Maheshwari being woven on the banks of the Narmada, a Chanderi so light it floats, a Bagh block-print laid out on the river-bed of Madhya Pradesh, a Gond painting in dots and stripes, a Dhokra figure cast in lost-wax in Bastar. In Rajasthan, a Gota Patti border being couched in Jaipur, a Bandhani being tied knot-by-knot in Jodhpur.',
    'In Gujarat, a Patola being double-ikat-tied in Patan for six months. In Bihar, a Madhubani being drawn by a woman on the wall of her own home. In Bengal, a Baluchari telling Mahabharata stories in weft, a Jamdani as light as breath, a Kantha stitched from old saris.',
    'In the south, a Kalamkari being hand-drawn with a tamarind-twig pen in Srikalahasti, a Kanchipuram silk being weighted with gold zari, a Pochampalli ikat being tied before it ever touches the loom. In Tamil Nadu, a Thanjavur painting layered in gold leaf, a Swamimalai bronze cast in the lost-wax tradition of the Cholas. In Kerala, an Aranmula Kannadi metal mirror.',
    'In the northeast, a Muga silk in Assam glowing gold without a single dye, an Eri silk in peace-silk, a Naga shawl on a backstrap loom, a Manipuri Wangkhei Phee, an Apatani textile in Arunachal.',
    'But every search led me to either a mass-produced copy, or a designer interpretation. Never the thing itself. Never the hands that made it.',
    'So I started travelling. Three years. Eighteen states. Two hundred and forty artisan clusters. And I found that the rare, the rooted, the personal still exists. It is just quiet.',
    'NEEJEE is the place I built for all of them. Every piece is found, personal, and named. The maker is named. The region is named. The technique is named. We pay our artisans in advance and on time. We never compromise on the thing itself.',
  ],
  closingLine: 'One place. One spotlight. One honest price. For every pair of hands India has forgotten to celebrate.',
  stats: [
    { label: 'FOUNDED', value: '2026', note: 'Mumbai · Varanasi · Jaipur' },
    { label: 'ARTISAN PARTNERS', value: '240+', note: 'Across 18 states' },
    { label: 'FAIR-TRADE', value: '100%', note: 'Above MSP · Paid in advance' },
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
    // CMS structure: one section of type 'text' with `data.body` containing
    // a single long text with sections separated by blank lines.
    // First line = title, second line = pullquote (if starts with ").
    // Or use multiple typed sections.
    const merged: any = { ...DEFAULT_CONTENT };
    for (const s of sections as any[]) {
      if (s?.type === 'hero' && s.data) {
        if (s.data.eyebrow) merged.eyebrow = s.data.eyebrow;
        if (s.data.title) merged.title = s.data.title;
        if (s.data.subtitle) merged.pullquote = s.data.subtitle;
      } else if (s?.type === 'quote' && s.data) {
        if (s.data.text) merged.pullquote = s.data.text;
        if (s.data.attribution) merged.attribution = s.data.attribution;
      } else if (s?.type === 'text' && s.data?.body) {
        const paras = String(s.data.body).split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean);
        if (paras.length > 0) merged.paragraphs = paras;
      } else if (s?.type === 'cta' && s.data) {
        if (s.data.ctaText) merged.ctaText = s.data.ctaText;
        if (s.data.ctaUrl) merged.ctaUrl = s.data.ctaUrl;
      }
    }
    return merged;
  } catch {
    return DEFAULT_CONTENT;
  }
}

export default async function AboutPage() {
  const c = await getAboutContent();
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="label text-madder mb-4">{c.eyebrow}</p>
        <h1 className="font-display text-5xl md:text-6xl text-kohl leading-tight">{c.title}</h1>
        <div className="madder-divider mx-auto mt-8"></div>
        <p className="editorial-pullquote mt-12">&ldquo;{c.pullquote}&rdquo;</p>
        <p className="text-center text-xs tracking-[0.25em] text-mitti mt-6">{c.attribution}</p>
      </section>

      <section className="max-w-2xl mx-auto px-6 py-12 font-body text-[15px] md:text-base text-kohl/85 leading-[1.85] space-y-5">
        {c.paragraphs.map((p, i) => (<p key={i}>{p}</p>))}
        {c.closingLine && (
          <p className="font-display italic text-xl md:text-2xl text-mitti pt-4">{c.closingLine}</p>
        )}
      </section>

      <section className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-6">
        {c.stats.map(s => (
          <div key={s.label} className="text-center p-8 bg-beige">
            <p className="label text-madder">{s.label}</p>
            <p className="font-display text-5xl text-kohl mt-3">{s.value}</p>
            <p className="font-italic italic text-mitti mt-2">{s.note}</p>
          </div>
        ))}
      </section>

      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <Link href={c.ctaUrl} className="btn-primary inline-block">{c.ctaText}</Link>
      </section>
      <Footer />
    </>
  );
}
