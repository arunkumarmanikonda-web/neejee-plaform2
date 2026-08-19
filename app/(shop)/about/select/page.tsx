// NEEJEE Select — CMS-overridable brand standard page.
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SectionRenderer, type Section } from '@/components/cms/SectionRenderer';
import { loadCmsOrNull } from '@/lib/cms-or-fallback';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = {
  title: 'NEEJEE Select · Founder-curated craft',
  description: 'What the NEEJEE Select mark means: a founder-led review of provenance, craft context, product readiness and the evidence available for each piece.',
};

export default async function NeejeeSelectPage() {
  const cms = await loadCmsOrNull('about-select');
  const sections: Section[] = Array.isArray(cms?.sections) ? (cms!.sections as any) : [];

  return (
    <>
      <Header />
      {cms && sections.length > 0 ? (
        <main>{sections.map((section) => <SectionRenderer key={section.id} section={section} />)}</main>
      ) : (
        <main>
          <section className="max-w-3xl mx-auto px-6 pt-20 pb-14 text-center">
            <p className="editorial-kicker">A CURATED MARK OF TRUST</p>
            <h1 className="font-display text-5xl md:text-6xl text-kohl leading-tight mt-4">NEEJEE Select.</h1>
            <div className="ornament-rule justify-center mt-8"><span className="font-display italic text-mitti text-sm">Found carefully. Explained clearly.</span></div>
            <p className="editorial-pullquote mt-12">
              A Select mark should tell you why a piece belongs here, not merely ask you to believe that it does.
            </p>
            <p className="font-display italic text-mitti mt-6">Nidhi Chauhan, Founder</p>
          </section>

          <section className="max-w-3xl mx-auto px-6 py-10 font-display text-[17px] md:text-[18px] text-kohl/82 leading-[1.8] space-y-6">
            <p>
              NEEJEE Select is our founder-led curation standard. It is reserved for pieces that have been reviewed for the information available about their origin, making, materials and presentation before they are given additional editorial prominence.
            </p>
            <p>
              We do not use the seal as a substitute for evidence. Where maker, atelier, region, technique or material provenance has been documented, we aim to show it on the product record. Where a detail has not yet been verified, it should not be presented as fact.
            </p>
            <p>
              The standard also includes the less romantic work that matters online: approved product imagery, sellable stock, clear commercial terms and a product record ready to be shown without hidden gaps.
            </p>
            <p className="font-display italic text-2xl text-mitti text-center pt-3">Rare, rooted and personally considered.</p>
          </section>

          <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-5">
            {[
              { label: 'PROVENANCE', value: 'Documented', note: 'Origin and maker context are shown when they have been verified.' },
              { label: 'CRAFT', value: 'Explained', note: 'Technique and material claims should be specific enough to understand.' },
              { label: 'READINESS', value: 'Reviewed', note: 'Images, stock and publication state must support the customer promise.' },
            ].map((standard) => (
              <div key={standard.label} className="paper-panel text-center p-8">
                <p className="editorial-kicker">{standard.label}</p>
                <p className="font-display text-4xl text-kohl mt-3">{standard.value}</p>
                <p className="font-display italic text-mitti mt-3 text-[14px] leading-relaxed">{standard.note}</p>
              </div>
            ))}
          </section>

          <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
            <p className="font-display italic text-mitti mb-7">The catalogue will grow. The standard should not become easier.</p>
            <Link href="/" className="btn-primary inline-block">EXPLORE NEEJEE</Link>
          </section>
        </main>
      )}
      <Footer />
    </>
  );
}
