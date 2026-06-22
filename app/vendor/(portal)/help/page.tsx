import { Mail, MessageCircle } from 'lucide-react';

export default function VendorHelpPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-5">
      <header>
        <h1 className="font-display text-3xl text-kohl">Help &amp; Support</h1>
        <p className="text-sm text-mitti mt-1">Questions about a PO, payment, or your profile? We're here.</p>
      </header>

      <section className="grid md:grid-cols-2 gap-3">
        <a href="mailto:partners@neejee.com" className="block bg-ivory border border-mitti/15 p-5 hover:border-madder">
          <Mail className="w-5 h-5 text-madder mb-2" />
          <p className="font-display text-lg text-kohl">Email us</p>
          <p className="text-sm text-mitti">partners@neejee.com</p>
          <p className="text-[10px] text-mitti mt-2">Typical response: 24 hours, weekdays</p>
        </a>
        <a href="https://wa.me/919650936747" target="_blank" rel="noreferrer" className="block bg-ivory border border-mitti/15 p-5 hover:border-madder">
          <MessageCircle className="w-5 h-5 text-madder mb-2" />
          <p className="font-display text-lg text-kohl">WhatsApp</p>
          <p className="text-sm text-mitti">+91 96509 36747</p>
          <p className="text-[10px] text-mitti mt-2">For urgent dispatch / GRN issues</p>
        </a>
      </section>

      <section className="bg-ivory border border-mitti/15 p-5">
        <h2 className="font-display text-lg text-kohl mb-3">Common questions</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-display text-kohl">Why does changing my bank details need approval?</dt>
            <dd className="text-mitti">Because NEEJEE wires payouts to that account. Verifying the change against a cancelled cheque or bank statement protects both of us against typos or fraud.</dd>
          </div>
          <div>
            <dt className="font-display text-kohl">How long does verification take?</dt>
            <dd className="text-mitti">Usually within one business day. Urgent cases — ping us on WhatsApp.</dd>
          </div>
          <div>
            <dt className="font-display text-kohl">Can I upload documents over email/WhatsApp instead?</dt>
            <dd className="text-mitti">Yes. Send them to partners@neejee.com or our WhatsApp number — the admin will upload them on your behalf and the documents will appear in your portal.</dd>
          </div>
          <div>
            <dt className="font-display text-kohl">My PO shows the wrong quantity / amount.</dt>
            <dd className="text-mitti">Confirm the PO with a note in the description, or call us before marking dispatch. We can revise PO line items before dispatch.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
