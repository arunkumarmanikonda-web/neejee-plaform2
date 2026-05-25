import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function ReturnsPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16">
        <p className="label text-madder text-center">PERSONALLY EASY</p>
        <h1 className="font-display text-5xl text-kohl text-center mt-4">Returns & Exchange</h1>
        <div className="madder-divider mx-auto mt-6 mb-12"></div>

        <div className="font-body text-lg text-kohl/85 space-y-6">
          <p>If it does not feel personal — return it within 7 days. No questions asked.</p>
          <div className="bg-beige p-8">
            <p className="label text-madder mb-3">HOW TO RETURN</p>
            <ol className="space-y-2 list-decimal list-inside">
              <li>Sign in &amp; visit <span className="font-medium">My Orders</span></li>
              <li>Select the order &amp; click &ldquo;Initiate Return&rdquo;</li>
              <li>We schedule a free pickup within 24-48 hours</li>
              <li>Refund processed within 5-7 business days of receipt</li>
            </ol>
          </div>
          <div className="bg-beige p-8">
            <p className="label text-madder mb-3">FINAL SALE (NOT RETURNABLE)</p>
            <ul className="space-y-2">
              <li>• Sarees that have been blouse-stitched or pre-pleated</li>
              <li>• Jewellery that has been worn or sized</li>
              <li>• Custom or made-to-order pieces</li>
              <li>• Fragrances (attars) once opened</li>
              <li>• Items damaged from misuse or improper care</li>
            </ul>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
