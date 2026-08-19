import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Shipping',
  description: 'Current NEEJEE shipping methods, charges and delivery guidance for India orders.',
  alternates: { canonical: '/help/shipping' },
};

export default function ShippingPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="label text-madder text-center">FROM NEEJEE TO YOUR DOOR</p>
        <h1 className="font-display text-5xl text-kohl text-center mt-4">Shipping</h1>
        <div className="madder-divider mx-auto mt-6"></div>

        <div className="mt-12 font-body text-lg text-kohl/85 space-y-8">
          <div className="bg-beige p-8">
            <p className="label text-madder">CURRENT INDIA DELIVERY</p>
            <ul className="mt-4 space-y-2">
              <li>• Standard shipping: ₹150 on orders below ₹2,500</li>
              <li>• Express shipping: ₹250 on orders below ₹2,500</li>
              <li>• Shipping is complimentary from ₹2,500 under the current default India shipping rule</li>
              <li>• Standard delivery guidance: 4–7 business days</li>
              <li>• Express delivery guidance: 2–3 business days, where the checkout offers it</li>
            </ul>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder">WHAT CHECKOUT CONFIRMS</p>
            <p className="mt-4">
              The delivery method and final shipping charge shown at checkout are authoritative for your order. Availability can depend on the destination, the pieces in your trunk and the shipping rules active at that time.
            </p>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder">CASH ON DELIVERY</p>
            <p className="mt-4">
              COD may be offered for eligible India orders up to ₹25,000. It is available only when every selected piece is COD-eligible, and the checkout will make the final determination before an order is accepted.
            </p>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder">TRACKING &amp; PRESENTATION</p>
            <p className="mt-4">
              When shipment tracking is available for an order, the tracking reference or link is surfaced with the order update. Presentation and protective packaging are chosen for the specific piece and shipment rather than promised as one universal format.
            </p>
          </div>

          <p className="font-display italic text-mitti text-center pt-2">
            Current checkout is configured for India delivery. We will publish additional destinations only when they are enabled in the live fulfilment flow.
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}
