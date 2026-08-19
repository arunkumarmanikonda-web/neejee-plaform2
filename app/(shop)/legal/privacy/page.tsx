import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How NEEJEE collects, uses and protects personal data when you browse, create an account, place an order or use assisted experiences.',
  alternates: { canonical: '/legal/privacy' },
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16 font-body text-kohl/85 leading-relaxed">
        <p className="label text-madder">PRIVACY · UPDATED AUGUST 2026</p>
        <h1 className="font-display text-5xl text-kohl mt-4">Privacy Policy</h1>
        <div className="madder-divider mt-6 mb-12"></div>

        <p className="font-display italic text-xl text-mitti mb-8">
          Personal should remain personal. This policy explains what NEEJEE needs, why we need it, and the choices available to you.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-10">Information we may collect</h2>
        <p className="mt-3">
          Depending on how you use NEEJEE, this can include your name, email address, mobile number, account information, shipping and billing details, order history, support communications, consent choices, device or browsing information used for security and analytics, and content you choose to submit to an assisted or AI-enabled feature.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-8">How we use it</h2>
        <ul className="list-disc list-inside mt-3 space-y-1">
          <li>To create and secure accounts and authenticate sign-in activity</li>
          <li>To price, process, fulfil, track and support orders</li>
          <li>To provide requested features, including eligible assisted experiences</li>
          <li>To prevent abuse, investigate errors and protect the service</li>
          <li>To understand service performance and improve NEEJEE</li>
          <li>To send marketing communications where the required choice or consent has been provided</li>
        </ul>

        <h2 className="font-display text-2xl text-kohl mt-8">Payments</h2>
        <p className="mt-3">
          Online payment credentials are submitted through the payment provider used by checkout. NEEJEE keeps the order, transaction reference, payment status and related reconciliation information needed to operate and support the purchase; we do not need your full card credentials to fulfil an order.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-8">AI and assisted experiences</h2>
        <p className="mt-3">
          If a feature asks you to upload an image or other content, that content is used to provide the experience you requested and may be processed by service providers necessary to generate or deliver the result. Feature-specific notices, where shown, form part of this policy. We do not state a fixed deletion period unless that retention rule is actually implemented for the relevant feature.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-8">Service providers</h2>
        <p className="mt-3">
          NEEJEE uses service providers to operate functions such as hosting, databases and storage, payments, transactional communications, security, analytics, logistics and eligible AI-assisted features. We share only the information reasonably required for the service being performed and apply contractual or platform controls appropriate to that relationship.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-8">Retention</h2>
        <p className="mt-3">
          Retention depends on why the information is held. Order, tax, accounting, fraud-prevention, security and dispute records can require different retention periods from optional marketing or feature data. We aim to keep personal data no longer than reasonably necessary for the applicable purpose and legal obligations.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-8">Your choices and requests</h2>
        <p className="mt-3">
          Subject to applicable law and the nature of the record, you may ask to access or correct personal data, request deletion where available, withdraw a consent you previously gave, or raise a privacy grievance. Some records may need to be retained where law, accounting, security, fraud-prevention or an active dispute requires it.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-8">Security</h2>
        <p className="mt-3">
          We use technical and organisational controls intended to protect accounts and personal data, including access controls and additional assurance for privileged administrative access. No internet service can promise absolute security, so we also monitor and improve these controls over time.
        </p>

        <h2 className="font-display text-2xl text-kohl mt-8">Contact</h2>
        <p className="mt-3">
          For a privacy request or grievance, write to <a href="mailto:hello@neejee.com" className="text-madder underline underline-offset-4">hello@neejee.com</a> with enough information for us to identify the relevant account or interaction. We may need to verify your identity before acting on a request.
        </p>

        <p className="mt-10 text-sm text-mitti">
          India&apos;s digital personal data framework continues to be implemented through the Digital Personal Data Protection Act and the rules and notifications issued under it. This policy describes NEEJEE&apos;s operational practices and is not a representation of certification by a regulator.
        </p>
      </section>
      <Footer />
    </>
  );
}
