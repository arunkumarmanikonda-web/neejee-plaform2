// v23.40.25 — Track Order page. Redirects signed-in users to /account?tab=orders.
// For guests, offers a form to look up an order by orderNumber + email.
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Package, ArrowRight, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function TrackOrderPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.email) setMe(d); })
      .finally(() => setLoadingMe(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanOrder = orderNumber.trim().toUpperCase();
    if (!cleanOrder) {
      setError('Please enter your order number.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter the email used at checkout.');
      return;
    }
    setSubmitting(true);
    // Public lookup endpoint will validate order# + email and redirect to a tokenized view.
    try {
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: cleanOrder, email: email.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.url) {
        setError(d.error || 'We could not find that order. Please check your order number and email.');
        return;
      }
      router.push(d.url);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="label text-madder">PERSONALLY DELIVERED</p>
        <h1 className="font-display text-5xl text-kohl mt-4">Track Order</h1>
        <p className="font-italic italic text-mitti mt-4">From our atelier to your door.</p>
        <div className="madder-divider mx-auto mt-6"></div>
      </section>

      <section className="max-w-2xl mx-auto px-6 pb-20">
        {loadingMe ? (
          <div className="text-center text-mitti"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
        ) : me ? (
          // Signed-in: deep-link to their orders dashboard
          <div className="bg-beige p-10 text-center">
            <Package className="w-10 h-10 text-madder mx-auto mb-4" />
            <p className="font-display text-2xl text-kohl">You&apos;re signed in as {me.name || me.email}.</p>
            <p className="text-mitti mt-2">Track every order from your account.</p>
            <Link href="/account?tab=orders" className="btn-primary inline-flex items-center gap-2 mt-6">
              MY ORDERS <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          // Guest: look up by order# + email
          <form onSubmit={submit} className="bg-beige p-10 space-y-4">
            <p className="font-display text-2xl text-kohl text-center">Look up your order</p>
            <p className="text-mitti text-sm text-center">Use the order number from your confirmation email.</p>

            <div>
              <label className="label text-mitti">ORDER NUMBER</label>
              <input
                type="text"
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                placeholder="NEE-XXXXXXXX"
                className="w-full mt-1 p-3 bg-ivory border border-mitti/20 font-mono"
              />
            </div>

            <div>
              <label className="label text-mitti">EMAIL USED AT CHECKOUT</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full mt-1 p-3 bg-ivory border border-mitti/20"
              />
            </div>

            {error && <p className="text-madder text-sm">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Looking up…</> : 'TRACK MY ORDER →'}
            </button>

            <p className="text-xs text-mitti text-center pt-2 border-t border-mitti/15">
              Lost your order number? <Link href="/help/contact" className="text-madder underline">Write to us</Link> — we&apos;ll find it for you.
            </p>
          </form>
        )}
      </section>
      <Footer />
    </>
  );
}
