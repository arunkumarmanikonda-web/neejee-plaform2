// v23.40.25 — Sustainability page. CMS-overridable.
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SectionRenderer, type Section } from '@/components/cms/SectionRenderer';
import { loadCmsOrNull } from '@/lib/cms-or-fallback';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = {
  title: 'Sustainability · NEEJEE',
  description: 'Hand-loomed. Natural dyes. Above-MSP wages. Paid in advance. Sustainability at NEEJEE is not a campaign — it is the only way we know how to work.',
};

export default async function SustainabilityPage() {
  const cms = await loadCmsOrNull('about-sustainability');
  const sections: Section[] = Array.isArray(cms?.sections) ? (cms!.sections as any) : [];

  return (
    <>
      <Header />
      {cms && sections.length > 0 ? (
        <main>{sections.map((s) => <SectionRenderer key={s.id} section={s} />)}</main>
      ) : (
        <>
          <section className="max-w-3xl mx-auto px-6 py-20 text-center">
            <p className="label text-madder mb-4">SLOW, NOT LOUD</p>
            <h1 className="font-display text-5xl md:text-6xl text-kohl leading-tight">Sustainability.</h1>
            <div className="madder-divider mx-auto mt-8"></div>
            <p className="editorial-quote mt-12">
              &ldquo;The cleanest piece is the one that already exists, made by hand, paid for honestly.&rdquo;
            </p>
            <p className="font-italic italic text-mitti mt-6">— Nidhi Chauhan, Founder</p>
          </section>

          <section className="max-w-3xl mx-auto px-6 py-12 font-body text-lg text-kohl/85 leading-relaxed space-y-6">
            <p>
              Sustainability at NEEJEE is not a campaign. It is the only way we know how to work.
            </p>
            <p>
              Every NEEJEE piece is hand-loomed, hand-finished, or hand-painted. No factory tracks. No bulk dye-runs.
              No synthetic shortcuts. We use natural dyes where the tradition does, and we let traditions that use
              acid dyes stay honest about it — we never greenwash.
            </p>
            <p>
              We pay our weavers above the government Minimum Support Price, in advance, every cycle. Some pieces take
              fourteen days, some take fourteen months. We do not rush. Speed is the opposite of craft.
            </p>
            <p>
              Our packaging is paper, muslin, and neem leaves. Every order arrives in a mango-wood Sandook with a
              brass clasp — designed to be re-used as a keepsake box, not discarded.
            </p>
            <p className="font-display italic text-2xl text-mitti">
              If sustainability has a sound, it is the quiet of a loom in motion.
            </p>
          </section>

          <section className="max-w-8xl mx-auto px-6 py-20 grid lg:grid-cols-4 gap-6">
            {[
              { label: 'HAND-MADE', value: '100%', note: 'Every piece touched by a human hand.' },
              { label: 'WAGES', value: 'Above MSP', note: 'Paid in advance, every cycle.' },
              { label: 'PACKAGING', value: 'Plastic-free', note: 'Mango-wood, muslin, neem.' },
              { label: 'WATER USE', value: '90% less', note: 'vs. mass-market textile dyeing.' },
            ].map(s => (
              <div key={s.label} className="text-center p-6 bg-beige">
                <p className="label text-madder">{s.label}</p>
                <p className="font-display text-4xl text-kohl mt-3">{s.value}</p>
                <p className="font-italic italic text-mitti mt-2 text-sm">{s.note}</p>
              </div>
            ))}
          </section>
        </>
      )}
      <Footer />
    </>
  );
}
