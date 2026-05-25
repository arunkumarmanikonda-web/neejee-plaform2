import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata = { title: 'Sell with NEEJEE · Artisan Onboarding' };

export default function SellersPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <p className="label text-madder">FOR ARTISANS · STUDIOS · ATELIERS</p>
        <h1 className="font-display text-5xl md:text-6xl text-kohl mt-4 leading-tight">Sell with NEEJEE.</h1>
        <p className="font-italic italic text-xl text-mitti mt-4">
          A platform for India&apos;s finest. Curated, never crowded.
        </p>
        <div className="madder-divider mx-auto mt-8"></div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
        {[
          { t: 'CURATED, NOT CROWDED', d: 'We accept fewer than 1 in 30 applications. Quality over volume.' },
          { t: 'FAIR PAY, PAID FAST', d: 'Weekly payouts. 18-22% commission. No hidden fees.' },
          { t: 'STORY-FIRST LISTINGS', d: 'We feature you, your craft, your name. Not just the SKU.' },
          { t: 'AI-POWERED MARKETING', d: 'NEEJEE Mirror & Space drive 4x more conversions on your products.' },
          { t: 'PAN-INDIA LOGISTICS', d: 'Shiprocket-powered. Pick-up from your studio. Door delivery, COD.' },
          { t: 'GROW WITH NEEJEE SELECT', d: 'Top sellers get featured in our quarterly editorial drops.' },
        ].map(b => (
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
            ['01', 'APPLY', 'Tell us about your craft, region, and clusters. 5-minute form.'],
            ['02', 'CURATE', 'Send 3 samples. We review with our craft council in 14 days.'],
            ['03', 'CONTRACT', 'Sign fair-trade agreement. Get your seller dashboard.'],
            ['04', 'LAUNCH', 'Upload your catalogue. We photograph, story, and list.'],
            ['05', 'SELL', 'You make it. We sell it. You get paid weekly.'],
          ].map(([n,t,d]) => (
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
          <Link href="/sellers/apply" className="btn-primary inline-block">BEGIN APPLICATION</Link>
        </div>
      </section>
      <Footer />
    </>
  );
}
