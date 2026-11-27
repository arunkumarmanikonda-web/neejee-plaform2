import Link from 'next/link';
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
              Read the piece’s return terms before ordering. If the terms shown now differ from your order confirmation, let the team know when you contact us.
            </p>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder mb-3">IF YOUR PIECE IS RETURN-ELIGIBLE</p>
            <ol className="space-y-2 list-decimal list-inside">
              <li>Open your order in <Link className="text-madder" href="/account?tab=orders">My orders</Link>. For a guest purchase, <Link className="text-madder" href="/help/track">look up the order</Link> with your order number and checkout email.</li>
              <li>Once it shows as delivered, open Returns &amp; help, choose the piece and quantity, and tell us what happened.</li>
              <li>Keep your request reference. The team reviews the case and posts updates and any return instructions on the order.</li>
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
              For damage or a different piece, choose the matching reason inside the delivered order. Keep any photographs in case our team asks for them. For other delivery issues, contact us with your order number.
            </p>
          </div>

          <Link href="/help/contact" className="btn-secondary inline-flex">Contact the team</Link>
        </div>
      </section>
      <Footer />
    </>
  );
}
