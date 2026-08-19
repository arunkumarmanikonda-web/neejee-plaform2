import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Sell with us · Artisan Onboarding',
  description: 'Apply to sell with NEEJEE. Review curation, onboarding and commercial terms before seller activation.',
  alternates: { canonical: '/sellers' },
};

export default function SellersPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="label text-madder">FOR ARTISANS · STUDIOS · ATELIERS</p>
        <h1 className="font-display text-5xl md:text-6xl text-kohl mt-4 leading-tight">Sell with NEEJEE.</h1>
        <p className="font-display italic text-xl text-mitti mt-4">
          A platform for India&apos;s finest. Curated, never crowded.
        </p>
        <div className="madder-divider mx-auto mt-8"></div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/sell/apply" className="btn-primary inline-block">BEGIN APPLICATION</Link>
          <Link href="/seller/login" className="font-ui text-xs tracking-widest text-kohl hover:text-madder underline underline-offset-4">
            EXISTING SELLER? SIGN IN →
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
        {[
          { t: 'CURATED, NOT CROWDED', d: 'Applications are reviewed for craft quality, provenance, business readiness and fit before approval.' },
          { t: 'CLEAR COMMERCIAL TERMS', d: 'Your commission, payout cycle and commercial terms are stated in the seller instrument for review before you sign.' },
          { t: 'STORY-FIRST LISTINGS', d: 'We feature you, your craft and your name, not just the SKU.' },
          { t: 'AI-ASSISTED DISCOVERY', d: 'Eligible products can use NEEJEE Mirror, Space and other assisted-discovery experiences where available.' },
          { t: 'CONNECTED FULFILMENT', d: 'Integrated fulfilment workflows support pickup, shipment tracking and eligible payment methods.' },
          { t: 'GROW WITH NEEJEE SELECT', d: 'Selected sellers and products may be featured in curated NEEJEE edits and editorial experiences.' },
        ].map((b) => (
          <div key={b.t} className="bg-beige p-6">
            <p className="label text-madder">{b.t}</p>
            <p className="font-body text-kohl/85 mt-3">{b.d}</p>
          </div>
        ))}
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl text-kohl text-center">How to apply</h2>
        <div className="madder-divider mx-auto mt-4 mb-12"></div>
        <ol className="space-y-6 font-body text-lg text-kohl/85">
          {[
            ['01', 'APPLY', 'Tell us about your craft, region, and clusters. Complete KYC and onboarding.'],
            ['02', 'CURATE', 'Upload samples and documents. We review them as part of the curation process.'],
            ['03', 'REVIEW', 'We verify business, bank, and craft details.'],
            ['04', 'APPROVE', 'Review and sign your commercial terms, then activate your seller dashboard.'],
            ['05', 'LAUNCH', 'Upload your catalogue. Approved products can then be prepared and listed for sale.'],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-6">
              <span className="font-display text-4xl text-mitti/40">{n}</span>
              <div>
                <p className="label text-madder">{t}</p>
                <p className="mt-1">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="text-center mt-12">
          <Link href="/sell/apply" className="btn-primary inline-block">BEGIN APPLICATION</Link>
          <p className="text-xs text-mitti mt-3">Takes about 5 minutes to start. KYC and documents are collected in the flow.</p>
        </div>
      </section>
      <Footer />
    </>
  );
}
