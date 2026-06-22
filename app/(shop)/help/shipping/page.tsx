import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function ShippingPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="label text-madder text-center">FROM OUR ATELIER TO YOUR DOOR</p>
        <h1 className="font-display text-5xl text-kohl text-center mt-4">Shipping</h1>
        <div className="madder-divider mx-auto mt-6"></div>

        <div className="prose mt-12 font-body text-lg text-kohl/85 space-y-8">
          <div className="bg-beige p-8">
            <p className="label text-madder">DOMESTIC</p>
            <ul className="mt-4 space-y-2">
              <li>• Free shipping above ₹2,500 (pan-India)</li>
              <li>• Metros: ₹100 flat</li>
              <li>• Tier 2/3: ₹150 flat</li>
              <li>• Delivery: 3-5 business days (in-stock), 14-28 days (made-to-order)</li>
              <li>• COD: Available below ₹15,000 to most pincodes</li>
              <li>• Tracking via WhatsApp + email</li>
            </ul>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder">INTERNATIONAL</p>
            <ul className="mt-4 space-y-2">
              <li>• USA, UK, Canada, UAE, Singapore, Australia: 7-14 days</li>
              <li>• Calculated at checkout (DHL Express or Aramex)</li>
              <li>• Duties & taxes: Buyer-paid on delivery</li>
              <li>• Full tracking with WhatsApp updates</li>
            </ul>
          </div>

          <div className="bg-beige p-8">
            <p className="label text-madder">PACKAGING</p>
            <p className="mt-4">Every order arrives in a NEEJEE Sandook — hand-finished mango wood with brass clasp. Inside: muslin wrap, neem leaves for natural preservation, authenticity card, founder&apos;s note. Gift-ready, always.</p>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
