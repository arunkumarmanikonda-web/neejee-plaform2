// v23.40.25 — NEEJEE Select page. CMS-overridable: if an admin publishes a
// CMS page with slug "about-select", that page replaces this hard-coded copy.
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SectionRenderer, type Section } from '@/components/cms/SectionRenderer';
import { loadCmsOrNull } from '@/lib/cms-or-fallback';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = {
  title: 'NEEJEE Select · Founder-curated craft',
  description: 'Each NEEJEE Select piece is personally chosen by Nidhi. Verified weaver, verified region, verified technique. No exceptions.',
};

export default async function NeejeeSelectPage() {
  const cms = await loadCmsOrNull('about-select');
  const sections: Section[] = Array.isArray(cms?.sections) ? (cms!.sections as any) : [];

  return (
    <>
      <Header />
      {cms && sections.length > 0 ? (
        <main>{sections.map((s) => <SectionRenderer key={s.id} section={s} />)}</main>
      ) : (
        <>
          <section className="max-w-3xl mx-auto px-6 py-20 text-center">
            <p className="label text-madder mb-4">A CURATED MARK OF TRUST</p>
            <h1 className="font-display text-5xl md:text-6xl text-kohl leading-tight">NEEJEE Select.</h1>
            <div className="madder-divider mx-auto mt-8"></div>
            <p className="editorial-quote mt-12">
              &ldquo;Every NEEJEE Select piece is one I would wear, gift, or live with. Personally.&rdquo;
            </p>
            <p className="font-italic italic text-mitti mt-6">— Nidhi Chauhan, Founder</p>
          </section>

          <section className="max-w-3xl mx-auto px-6 py-12 font-body text-lg text-kohl/85 leading-relaxed space-y-6">
            <p>
              NEEJEE Select is not a category — it is a personal mark. Pieces that carry the Select seal have been
              verified by Nidhi against three quiet standards: the weaver is real and named, the region is real
              and named, and the technique is true to its tradition.
            </p>
            <p>
              We never mass-source. We never wholesale-import. Every Select piece was found on the loom, in the workshop,
              or in the hands of the maker who made it. We pay above MSP, in advance, every time.
            </p>
            <p>
              When you see the Select seal on a product page, it means this piece passed Nidhi&apos;s own filter — the
              same filter she uses for her trunk at home.
            </p>
            <p className="font-display italic text-2xl text-mitti">
              Rare, rooted, and quietly chosen.
            </p>
          </section>

          <section className="max-w-8xl mx-auto px-6 py-20 grid lg:grid-cols-3 gap-8">
            {[
              { label: 'WEAVER', value: 'Named', note: 'Every Select piece carries a named maker.' },
              { label: 'REGION', value: 'Verified', note: 'Source village or atelier is stated.' },
              { label: 'TECHNIQUE', value: 'True', note: 'No interpretations of tradition.' },
            ].map(s => (
              <div key={s.label} className="text-center p-8 bg-beige">
                <p className="label text-madder">{s.label}</p>
                <p className="font-display text-5xl text-kohl mt-3">{s.value}</p>
                <p className="font-italic italic text-mitti mt-2">{s.note}</p>
              </div>
            ))}
          </section>

          <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
            <Link href="/collections/founders-edit" className="btn-primary inline-block">
              SHOP THE NEEJEE SELECT EDIT
            </Link>
          </section>
        </>
      )}
      <Footer />
    </>
  );
}
