import { faqs } from '@/lib/shop-faq';
import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about NEEJEE curation, shipping, returns, COD, AI previews and seller commercial terms.',
  alternates: { canonical: '/help/faq' },
};

export default function FAQPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="label text-madder text-center">QUESTIONS, CLEARLY ANSWERED</p>
        <h1 className="font-display text-5xl text-kohl text-center mt-4">FAQ</h1>
        <div className="madder-divider mx-auto mt-6 mb-12"></div>
        <div className="space-y-4">
          {faqs.map((f, i) => (
            <details key={i} className="bg-beige p-6 group">
              <summary className="cursor-pointer font-display text-xl text-kohl flex justify-between items-center">
                {f.q}
                <span className="text-madder text-2xl group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="font-body text-kohl/85 mt-4 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <Footer />
    </>
  );
}
