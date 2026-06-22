'use client';
// app/payment/page.tsx
// v26.3a — Razorpay payment page.
// Now accepts ?snapshot=<id> (new prepaid flow) and ?order=<orderNumber>
// (legacy fallback). On success of /verify, clears the cart and navigates to
// the order confirmation page.
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Script from 'next/script';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShieldCheck } from 'lucide-react';
import { formatINR } from '@/lib/money';
import { useCart } from '@/lib/cart-store';

export const dynamic = 'force-dynamic';

function PaymentInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const { clear } = useCart();
  const snapshotId = sp?.get('snapshot');
  const orderNumber = sp?.get('order');

  const [rzpReady, setRzpReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<{ total: number; email?: string; phone?: string; name?: string } | null>(null);

  // ─── Beacon: if user abandons here, mark snapshot as abandoned ──────
  useEffect(() => {
    if (!snapshotId) return;
    const handler = () => {
      try {
        const blob = new Blob([JSON.stringify({ snapshotId, step: 'payment' })], {
          type: 'application/json',
        });
        navigator.sendBeacon('/api/checkout/abandon', blob);
      } catch { /* swallow */ }
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, [snapshotId]);

  // ─── Load info to display ───────────────────────────────────────────
  useEffect(() => {
    if (snapshotId) {
      // Fetch the snapshot for display (lightweight endpoint)
      fetch(`/api/checkout/snapshot/${snapshotId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.snapshot) {
            setInfo({
              total: d.snapshot.total,
              email: d.snapshot.email,
              phone: d.snapshot.phone,
              name: d.snapshot.customerName,
            });
          }
        }).catch(() => {});
      return;
    }
    if (orderNumber) {
      fetch(`/api/orders/${orderNumber}`).then(r => r.json()).then(d => {
        if (d?.order) setInfo({
          total: d.order.total,
          email: d.order.guestEmail || d.order.user?.email,
          phone: d.order.user?.phone,
          name: d.order.guestName || d.order.user?.name,
        });
      }).catch(() => {});
      return;
    }
    setError('No payment reference provided');
  }, [snapshotId, orderNumber]);

  const startPayment = async () => {
    if (!(window as any).Razorpay) { setError('Razorpay not loaded — please refresh'); return; }
    setLoading(true); setError('');
    try {
      const createBody: any = snapshotId ? { snapshotId } : { orderNumber };
      const r = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      const options: any = {
        key: d.keyId,
        amount: d.amount,
        currency: d.currency,
        order_id: d.razorpayOrderId,
        name: 'NEEJEE',
        description: snapshotId ? 'Your trunk' : `Order ${d.orderNumber}`,
        prefill: { email: info?.email || '', contact: info?.phone || '', name: info?.name || '' },
        theme: { color: '#8B2E2A' },
        handler: async (response: any) => {
          const verifyBody: any = {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          };
          if (snapshotId) verifyBody.snapshotId = snapshotId;
          if (!snapshotId && orderNumber) verifyBody.orderNumber = orderNumber;

          const v = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verifyBody),
          });
          const vd = await v.json();
          if (!v.ok) { setError(vd.error || 'Verification failed'); setLoading(false); return; }

          // v26.3a — Only clear cart AFTER verified payment success
          try { clear(); } catch {}
          try { sessionStorage.removeItem('neejee_checkout_snapshot'); } catch {}

          const newOrderNumber = vd?.order?.orderNumber || orderNumber;
          router.push(`/order-confirmation?order=${newOrderNumber}`);
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError('Payment was not completed. Your trunk is saved — return anytime.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRzpReady(true)} />
      <Header />
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="label text-madder">PAYMENT</p>
        <h1 className="font-display text-4xl text-kohl mt-3">Complete your order</h1>
        {snapshotId && (
          <p className="font-italic italic text-mitti mt-3">Your trunk awaits</p>
        )}
        {orderNumber && !snapshotId && (
          <p className="font-italic italic text-mitti mt-3">{orderNumber}</p>
        )}
        <div className="madder-divider mx-auto mt-6"></div>

        {info && (
          <div className="bg-beige p-8 mt-10 text-left">
            <p className="label text-madder">AMOUNT DUE</p>
            <p className="font-display text-4xl text-kohl mt-2">{formatINR(info.total)}</p>
            <p className="font-italic italic text-mitti mt-2">Inclusive of all taxes & shipping</p>
          </div>
        )}

        {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

        <button onClick={startPayment} disabled={!rzpReady || loading} className="btn-primary mt-8 disabled:opacity-50">
          {loading ? 'OPENING PAYMENT...' : rzpReady ? 'PAY NOW' : 'LOADING...'}
        </button>

        <div className="mt-8 flex items-center justify-center gap-2 text-mitti">
          <ShieldCheck className="w-4 h-4" />
          <p className="font-ui text-xs tracking-widest">SECURED BY RAZORPAY · 256-BIT SSL</p>
        </div>

        <p className="font-italic italic text-mitti text-sm mt-8 max-w-md mx-auto">
          Your card details never touch our servers. We use Razorpay's PCI DSS-certified vault.
          UPI · Cards · Net Banking · Wallets supported.
        </p>
      </section>
      <Footer />
    </>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="p-12 text-mitti">Loading...</div>}>
      <PaymentInner />
    </Suspense>
  );
}
