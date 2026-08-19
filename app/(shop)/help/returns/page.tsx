import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Returns & Exchanges',
  description: 'How NEEJEE return eligibility works, including product-specific non-returnable pieces and order support.',
  alternates: { canonical: '/help/returns' },
};

export default function ReturnsPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="label text-madder text-center">CLEAR BEFORE YOU CHOOSE</p>
        <h1 className="font-display text-5xl text-kohl text-center mt-4">Returns &amp; Exchanges</h1>
        <div className="madder-divider mx-auto mt-6 mb-12"></div>

        <div className="font-body text-lg text-kohl/85 space-y-7">
          <p>
            Return eligibility is set for each piece. Please read the product policy shown before purchase: some pieces are returnable, while others are explicitly marked non-returnable because of their nature, condition requirements or commercial terms.
          </p>

          <div className="bg-beige p-8">
            <p className="label text-madder mb-3">BEFORE YOU ORDER</p>
            <p>
              The product page and checkout record are the source of truth for return eligibility. A piece marked non-returnable does not become returnable under a general site statement.
            </p>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder mb-3">IF YOUR PIECE IS RETURN-ELIGIBLE</p>
            <ol className="space-y-2 list-decimal list-inside">
              <li>Open the order from your account or use the support details attached to the order.</li>
              <li>Choose the available return action and provide the requested reason or evidence.</li>
              <li>We will show the applicable pickup or return instructions for that order.</li>
              <li>Any approved refund is processed against the verified order and payment record.</li>
            </ol>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder mb-3">NON-RETURNABLE OR EXCEPTION CASES</p>
            <p>
              Product-level exclusions can include customised, altered, hygiene-sensitive, opened, used or otherwise specifically designated pieces. The exact policy displayed for the product governs the normal return route.
            </p>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder mb-3">DAMAGED OR INCORRECT DELIVERY</p>
            <p>
              If an order arrives damaged, materially different from what was ordered, or with an incorrect item, contact NEEJEE support with the order number and clear photographs. These cases are reviewed separately from a change-of-mind return request.
            </p>
          </div>

          <p className="font-display italic text-mitti text-center pt-2">
            We prefer the policy to be visible before the purchase rather than discovered after it.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}
