import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const faqs = [
  { q: 'How do I know the craft is authentic?', a: 'Every NEEJEE piece comes with a thappa seal authenticity card naming the weaver, region, technique, and date of production. We verify our artisans personally — many over multiple visits.' },
  { q: 'What is your return policy?', a: 'Easy 7-day returns on unworn items in original packaging. Sarees that have been blouse-stitched or jewellery that has been worn are not returnable. Custom or made-to-order pieces are final sale.' },
  { q: 'How fast do you ship?', a: 'In-stock items ship within 24-48 hours. Hand-loomed pieces marked "made to order" take 14-28 days. Pan-India free shipping above ₹2,500.' },
  { q: 'Do you ship internationally?', a: 'Yes, to USA, UK, Canada, UAE, Australia, Singapore. International shipping calculated at checkout. Duties and taxes are buyer-paid.' },
  { q: 'How does AI Mirror work?', a: 'Upload a photo, choose a piece marked ✦. Our AI generates a preview of you in that piece in 10-20 seconds. Photos are encrypted, never sold, auto-deleted in 30 days.' },
  { q: 'Is COD available?', a: 'Yes, on orders below ₹15,000 to select pincodes across India.' },
  { q: 'How are your artisans paid?', a: 'Above MSP, in advance, on weekly cycles. We never compromise on artisan wages.' },
];

export default function FAQPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="label text-madder text-center">QUESTIONS, PERSONALLY ANSWERED</p>
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
