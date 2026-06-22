import Link from 'next/link';
import { Mail, MessageCircle, HelpCircle } from 'lucide-react';

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl text-kohl">Help & Support</h1>
        <p className="text-mitti text-sm">We're here for you. Reach out any time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="mailto:partners@neejee.com"
          className="bg-ivory border border-mitti/20 p-6 rounded hover:border-kohl transition-colors">
          <Mail className="w-6 h-6 text-banarasi" />
          <h3 className="font-display text-lg text-kohl mt-3">Email us</h3>
          <p className="text-mitti text-sm mt-1">partners@neejee.com</p>
          <p className="text-mitti text-xs mt-1">We typically respond within 24 hours</p>
        </a>

        <a href="https://wa.me/919999999999?text=Hi%20NEEJEE%20partner%20support"
          target="_blank" rel="noreferrer"
          className="bg-ivory border border-mitti/20 p-6 rounded hover:border-kohl transition-colors">
          <MessageCircle className="w-6 h-6 text-banarasi" />
          <h3 className="font-display text-lg text-kohl mt-3">WhatsApp</h3>
          <p className="text-mitti text-sm mt-1">Quick questions, urgent help</p>
          <p className="text-mitti text-xs mt-1">9 am – 7 pm IST, Mon–Sat</p>
        </a>
      </div>

      <div className="bg-ivory border border-mitti/20 p-6 rounded">
        <h3 className="font-display text-xl text-kohl flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-banarasi" /> Common questions
        </h3>
        <dl className="mt-4 space-y-4">
          <FAQ q="Why do some profile changes need approval?"
            a="Sensitive fields — legal name, GSTIN, PAN, bank — are gated to prevent fraud. After your first save (during onboarding), any later change goes through admin review. You'll need to attach a supporting document (e.g. new GST certificate, cancelled cheque)." />
          <FAQ q="How does the inventory submission flow work?"
            a="You submit a product (one at a time or via Excel bulk). It goes into the admin queue. Our team reviews, polishes the listing copy & images, and publishes it live. You can see status on the Inventory page." />
          <FAQ q="When do I get buyer information for orders?"
            a="Buyer name, phone, and shipping address are revealed once an admin marks the order 'ready to dispatch'. This protects buyer privacy while you prepare the product." />
          <FAQ q="What's the difference between OWNED and MARKETPLACE products?"
            a="OWNED means NEEJEE bought the inventory from you upfront (we pay you on the PO, not per sale). MARKETPLACE means it's listed on consignment — you keep ownership until sold, and we take a commission." />
          <FAQ q="How are commissions calculated?"
            a="Default commission is set per studio. Some categories or specific products can have overrides. You can see the effective rate on each product's row in your Inventory." />
        </dl>
      </div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <dt className="font-display text-kohl">{q}</dt>
      <dd className="text-mitti text-sm mt-1">{a}</dd>
    </div>
  );
}
