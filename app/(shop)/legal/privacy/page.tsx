import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata = { title: 'Privacy · DPDP-Compliant' };

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16 font-body text-kohl/85 leading-relaxed">
        <p className="label text-madder">DPDP-COMPLIANT · UPDATED MAY 2026</p>
        <h1 className="font-display text-5xl text-kohl mt-4">Privacy Policy</h1>
        <div className="madder-divider mt-6 mb-12"></div>

        <p className="font-italic italic text-xl text-mitti mb-8">
          Your data is yours. We collect only what we need to find for you personally.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-10">What we collect</h2>
        <p>Email, name, phone, shipping address, order history, browsing behaviour on neejee.com, AI Mirror photos (with consent), payment metadata (not card numbers — handled by Razorpay).</p>

        <h2 className="font-display text-2xl text-kohl mt-8">How we use it</h2>
        <ul className="list-disc list-inside mt-3 space-y-1">
          <li>Fulfilling orders, sending updates, providing support</li>
          <li>Personalising your shopping (only with your consent)</li>
          <li>Improving NEEJEE — anonymised analytics</li>
          <li>Marketing — only if you opt in</li>
        </ul>

        <h2 className="font-display text-2xl text-kohl mt-8">AI Mirror photos</h2>
        <p>Encrypted at rest, never sold, auto-deleted 30 days from creation. You can delete anytime from your account.</p>

        <h2 className="font-display text-2xl text-kohl mt-8">Your DPDP rights</h2>
        <ul className="list-disc list-inside mt-3 space-y-1">
          <li>Right to access your data — request export anytime</li>
          <li>Right to correction — edit your profile</li>
          <li>Right to deletion — &ldquo;forget me&rdquo; via account settings or email</li>
          <li>Right to withdraw consent — anytime, without question</li>
          <li>Right to grievance redressal — DPO email below</li>
        </ul>

        <h2 className="font-display text-2xl text-kohl mt-8">Data Protection Officer</h2>
        <p>dpo@neejee.com · Replied within 7 days, per DPDP Act 2023.</p>

        <h2 className="font-display text-2xl text-kohl mt-8">Third parties</h2>
        <p>Razorpay (payments), Shiprocket (logistics), Klaviyo (email), WATI (WhatsApp), Cloudinary (media), Replicate (AI). Each is contractually bound to NEEJEE&apos;s privacy standards.</p>
      </section>
      <Footer />
    </>
  );
}
