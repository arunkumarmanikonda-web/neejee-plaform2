'use client';
import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Check, Mail, MessageCircle } from 'lucide-react';
import { track } from '@/lib/analytics';
import { useCart } from '@/lib/cart-store';

function ConfirmationInner() {
  const params = useSearchParams();
  const orderNumber = params.get('order') || params.get('id') || 'NEE-XXXXXXXX';
  const valueParam = params.get('value');
  const value = valueParam ? parseInt(valueParam) : undefined;
  const { clear } = useCart();

  useEffect(() => {
    if (orderNumber && orderNumber !== 'NEE-XXXXXXXX') {
      track({ type: 'PURCHASE', value });
      // Clear local cart on success
      try { clear(); } catch {}
    }
  }, [orderNumber, value, clear]);

  return (
    <section className="max-w-2xl mx-auto px-6 py-20 text-center">
      <div className="w-20 h-20 bg-madder text-ivory rounded-full mx-auto flex items-center justify-center">
        <Check className="w-10 h-10" />
      </div>
      <p className="label text-madder mt-8">ORDER PLACED</p>
      <h1 className="font-display text-5xl text-kohl mt-4">Personally received.</h1>
      <p className="font-italic italic text-xl text-mitti mt-4">Your trunk is being packed in our Mumbai atelier.</p>
      <div className="madder-divider mx-auto mt-8"></div>

      <div className="bg-beige p-8 mt-12 text-left">
        <p className="label text-madder">ORDER NUMBER</p>
        <p className="font-display text-3xl text-kohl mt-2">{orderNumber}</p>
        <p className="font-italic italic text-mitti mt-2">Save this — it&apos;s your key to the trunk.</p>

        <div className="madder-divider mt-6"></div>

        <div className="mt-6 space-y-3 font-body text-kohl/85">
          <div className="flex gap-3"><Mail className="w-4 h-4 mt-1 text-mitti flex-shrink-0" /><p>An email confirmation with GST invoice has been sent.</p></div>
          <div className="flex gap-3"><MessageCircle className="w-4 h-4 mt-1 text-mitti flex-shrink-0" /><p>WhatsApp updates from order to delivery on your phone.</p></div>
          <div className="flex gap-3"><Check className="w-4 h-4 mt-1 text-mitti flex-shrink-0" /><p>Founder&apos;s note + authenticity card included in your Sandook.</p></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10">
        <Link href="/account" className="btn-outline">TRACK MY ORDER</Link>
        {/* v23.40.18 — customer can immediately print/download their tax invoice */}
        {orderNumber && orderNumber !== 'NEE-XXXXXXXX' && (
          <a href={`/api/orders/${encodeURIComponent(orderNumber)}/invoice`} target="_blank" rel="noreferrer" className="btn-outline">
            DOWNLOAD INVOICE
          </a>
        )}
        <Link href="/" className="btn-primary">CONTINUE FINDING</Link>
      </div>

      <p className="font-italic italic text-mitti mt-16 text-lg">
        Personally, <br /><span className="font-display">Nidhi & the NEEJEE team</span>
      </p>
    </section>
  );
}

export default function OrderConfirmationPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="py-20 text-center font-italic italic text-mitti">Loading...</div>}>
        <ConfirmationInner />
      </Suspense>
      <Footer />
    </>
  );
}
