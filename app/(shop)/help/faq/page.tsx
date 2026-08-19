import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about NEEJEE curation, shipping, returns, COD, AI previews and seller commercial terms.',
  alternates: { canonical: '/help/faq' },
};

const faqs = [
  {
    q: 'How does NEEJEE handle authenticity and provenance?',
    a: 'We publish craft, region, material, maker and process details to the extent they are supported by the product and supplier record. A NEEJEE Select or editorial mark is not a substitute for evidence, and details that have not been verified should not be presented as fact.',
  },
  {
    q: 'What is your return policy?',
    a: 'Return eligibility is product-specific and is shown with the piece and order record. Some pieces may be marked non-returnable. For an eligible order, use the available order return flow or contact support. Damaged or incorrect deliveries are reviewed separately from ordinary return eligibility.',
  },
  {
    q: 'What are the current India shipping charges?',
    a: 'Under the current default rule, Standard shipping is ₹150 and Express is ₹250 for orders below ₹2,500. Shipping is complimentary from ₹2,500. The method and charge shown by checkout are authoritative for your destination and order.',
  },
  {
    q: 'Do you ship internationally?',
    a: 'The current checkout is configured for India delivery. Additional countries will be published only when they are enabled in the live fulfilment flow, rather than promised in advance.',
  },
  {
    q: 'How do NEEJEE AI previews work?',
    a: 'Eligible experiences can create an AI-assisted visual preview from the information or image you choose to provide. A preview is illustrative, not a guarantee of exact colour, scale, drape, fit or physical appearance. How uploaded information is handled is described in the Privacy Policy.',
  },
  {
    q: 'Is Cash on Delivery available?',
    a: 'COD may be offered for eligible India orders up to ₹25,000. Every selected piece must be COD-eligible and checkout makes the final eligibility decision before the order is accepted.',
  },
  {
    q: 'How are seller commissions and payouts decided?',
    a: 'Commercial terms are not represented as one universal rate or payout cycle. Commission, payout timing and other seller terms are stated in the applicable commercial instrument for review before activation.',
  },
];

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
