// Sustainability — CMS-overridable commitments and disclosure page.
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SectionRenderer, type Section } from '@/components/cms/SectionRenderer';
import { loadCmsOrNull } from '@/lib/cms-or-fallback';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = {
  title: 'Sustainability · NEEJEE',
  description: 'NEEJEE’s approach to slower consumption, craft provenance, materials disclosure, responsible packaging and evidence-led sustainability claims.',
};

export default async function SustainabilityPage() {
  const cms = await loadCmsOrNull('about-sustainability');
  const sections: Section[] = Array.isArray(cms?.sections) ? (cms!.sections as any) : [];

  return (
    <>
      <Header />
      {cms && sections.length > 0 ? (
        <main>{sections.map((section) => <SectionRenderer key={section.id} section={section} />)}</main>
      ) : (
        <main>
          <section className="max-w-3xl mx-auto px-6 pt-20 pb-14 text-center">
            <p className="editorial-kicker">SLOWER. CLEARER. ACCOUNTABLE.</p>
            <h1 className="font-display text-5xl md:text-6xl text-kohl leading-tight mt-4">Sustainability.</h1>
            <div className="ornament-rule justify-center mt-8"><span className="font-display italic text-mitti text-sm">A practice, not a badge.</span></div>
            <p className="editorial-pullquote mt-12">
              We would rather make a modest claim we can support than a beautiful claim we cannot prove.
            </p>
          </section>

          <section className="max-w-3xl mx-auto px-6 py-10 font-display text-[17px] md:text-[18px] text-kohl/82 leading-[1.8] space-y-6">
            <p>
              NEEJEE is being built around a simple preference: buy fewer things, know more about them, and keep them longer. Craft can support that idea, but craft by itself is not proof of environmental or social performance.
            </p>
            <p>
              Our product pages are intended to distinguish documented facts from editorial storytelling. Material, process, region, maker and packaging claims should be shown only to the extent that the underlying product or supplier record supports them.
            </p>
            <p>
              We favour durable materials, repairable objects, reusable presentation and lower-waste fulfilment choices where they are practical. As supplier evidence improves, we intend to publish more specific disclosures rather than rely on generic “green” language.
            </p>
            <p>
              The same standard applies to social claims. Commercial arrangements with makers and sellers can vary by engagement, so payment, wage or sourcing claims should be stated only where they are documented for the relevant relationship.
            </p>
            <p className="font-display italic text-2xl text-mitti text-center pt-3">The work is to make the record better, not the slogan louder.</p>
          </section>

          <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { label: 'PROVENANCE', value: 'Evidence first', note: 'Publish origin and making details when the supporting record exists.' },
              { label: 'MATERIALS', value: 'Be specific', note: 'Avoid broad natural, organic or low-impact claims without product-level support.' },
              { label: 'PACKAGING', value: 'Reduce waste', note: 'Prefer reusable and lower-waste choices, then disclose what is actually used.' },
              { label: 'PROGRESS', value: 'Keep measuring', note: 'Quantified impact claims belong here only after a defensible methodology exists.' },
            ].map((item) => (
              <div key={item.label} className="paper-panel text-center p-7">
                <p className="editorial-kicker">{item.label}</p>
                <p className="font-display text-[30px] text-kohl mt-3">{item.value}</p>
                <p className="font-display italic text-mitti mt-3 text-[13px] leading-relaxed">{item.note}</p>
              </div>
            ))}
          </section>
        </main>
      )}
      <Footer />
    </>
  );
}
