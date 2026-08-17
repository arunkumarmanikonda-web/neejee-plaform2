'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Check, ShieldCheck } from 'lucide-react';
import { formatINR } from '@/lib/money';
import { useCart } from '@/lib/cart-store';

export const dynamic = 'force-dynamic';

type VerifyBody = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  snapshotId?: string;
  orderNumber?: string;
};

type TerminalState = 'none' | 'finalizing' | 'refund' | 'manual';

const REFUND_CODES = new Set([
  'PAYMENT_REFUNDED_INVENTORY',
  'PAYMENT_REFUNDED_COUPON',
  'PAYMENT_REFUNDED_LOYALTY',
]);

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
  const [paymentCaptured, setPaymentCaptured] = useState(false);
  const [terminalState, setTerminalState] = useState<TerminalState>('none');
  const [pendingVerification, setPendingVerification] = useState<VerifyBody | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!snapshotId) return;
    const handler = () => {
      try {
        const blob = new Blob([JSON.stringify({ snapshotId, step: 'payment' })], {
          type: 'application/json',
        });
        navigator.sendBeacon('/api/checkout/abandon', blob);
      } catch {}
    };
    window.addEventListener('beforeunload', handler);
    window.addEventListener('pagehide', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      window.removeEventListener('pagehide', handler);
    };
  }, [snapshotId]);

  useEffect(() => {
    if (snapshotId) {
      fetch(`/api/checkout/snapshot/${snapshotId}`, { cache: 'no-store' })
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
        })
        .catch(() => {});
      return;
    }
    if (orderNumber) {
      fetch(`/api/orders/${orderNumber}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(d => {
          if (d?.order) {
            setInfo({
              total: d.order.total,
              email: d.order.guestEmail || d.order.user?.email,
              phone: d.order.user?.phone,
              name: d.order.guestName || d.order.user?.name,
            });
          }
        })
        .catch(() => {});
      return;
    }
    setError('No payment reference provided');
  }, [snapshotId, orderNumber]);

  const finalizePayment = async (verifyBody: VerifyBody, automaticAttempts = 2) => {
    setPendingVerification(verifyBody);
    setTerminalState('finalizing');
    setStatusMessage('Payment received. Confirming your order…');
    setError('');

    for (let attempt = 0; attempt <= automaticAttempts; attempt++) {
      try {
        const response = await fetch('/api/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verifyBody),
        });
        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          try { clear(); } catch {}
          try { sessionStorage.removeItem('neejee_checkout_snapshot'); } catch {}
          const newOrderNumber = data?.order?.orderNumber || orderNumber;
          if (!newOrderNumber) throw new Error('Order confirmed without an order number');
          setStatusMessage('Order confirmed. Taking you to your receipt…');
          router.push(`/order-confirmation?order=${encodeURIComponent(newOrderNumber)}`);
          return;
        }

        if (data?.code === 'PAYMENT_FINALIZATION_RETRY') {
          if (attempt < automaticAttempts) {
            setStatusMessage('Payment received. Final confirmation is taking a little longer…');
            await new Promise(resolve => setTimeout(resolve, 1600 * (attempt + 1)));
            continue;
          }
          setTerminalState('finalizing');
          setStatusMessage('Your payment is received. Order confirmation still needs to finish. Do not pay again.');
          setError('');
          setLoading(false);
          return;
        }

        if (REFUND_CODES.has(String(data?.code || ''))) {
          setTerminalState('refund');
          setStatusMessage(data.error || 'Your payment was received but this checkout could not be completed safely. A full refund has been initiated.');
          setError('');
          setLoading(false);
          return;
        }

        if (data?.code === 'PAYMENT_EXCEPTION') {
          setTerminalState('manual');
          setStatusMessage(data.error || 'Your payment is received and our team has been alerted to complete the resolution.');
          setError('');
          setLoading(false);
          return;
        }

        setTerminalState('manual');
        setStatusMessage('Your payment response was received, but confirmation needs attention. Do not make another payment.');
        setError(data?.error || 'Unable to finalize payment');
        setLoading(false);
        return;
      } catch (e: any) {
        if (attempt < automaticAttempts) {
          setStatusMessage('Payment received. Reconnecting to confirm your order…');
          await new Promise(resolve => setTimeout(resolve, 1600 * (attempt + 1)));
          continue;
        }
        setTerminalState('finalizing');
        setStatusMessage('Your payment is received. We could not reach order confirmation yet. Do not pay again.');
        setError('');
        setLoading(false);
        return;
      }
    }
  };

  const startPayment = async () => {
    if (paymentCaptured) return;
    if (!(window as any).Razorpay) {
      setError('Payment window is not ready. Please refresh this page.');
      return;
    }

    setLoading(true);
    setError('');
    setStatusMessage('');
    try {
      const createBody: any = snapshotId ? { snapshotId } : { orderNumber };
      const response = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createBody),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data?.code === 'INVENTORY_CHANGED') {
          setError(data.error || 'A selected piece is no longer available.');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Unable to open payment');
      }

      const options: any = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        order_id: data.razorpayOrderId,
        name: 'NEEJEE',
        description: snapshotId ? 'Your trunk' : `Order ${data.orderNumber}`,
        prefill: {
          email: info?.email || '',
          contact: info?.phone || '',
          name: info?.name || '',
        },
        theme: { color: '#8B2E2A' },
        handler: async (gatewayResponse: any) => {
          setPaymentCaptured(true);
          setLoading(true);
          const verifyBody: VerifyBody = {
            razorpay_order_id: gatewayResponse.razorpay_order_id,
            razorpay_payment_id: gatewayResponse.razorpay_payment_id,
            razorpay_signature: gatewayResponse.razorpay_signature,
            ...(snapshotId ? { snapshotId } : {}),
            ...(!snapshotId && orderNumber ? { orderNumber } : {}),
          };
          await finalizePayment(verifyBody);
        },
        modal: {
          ondismiss: () => {
            if (paymentCaptured) return;
            setLoading(false);
            setError('Payment was not completed. Your trunk is saved; you can continue when ready.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      setError(e.message || 'Unable to open payment');
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onLoad={() => setRzpReady(true)} />
      <Header />
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="label text-madder">PAYMENT</p>
        <h1 className="font-display text-4xl text-kohl mt-3">Complete your order</h1>
        {snapshotId && <p className="font-italic italic text-mitti mt-3">Your trunk awaits.</p>}
        {orderNumber && !snapshotId && <p className="font-italic italic text-mitti mt-3">{orderNumber}</p>}
        <div className="madder-divider mx-auto mt-6"></div>

        {info && (
          <div className="bg-beige p-8 mt-10 text-left">
            <p className="label text-madder">AMOUNT DUE</p>
            <p className="font-display text-4xl text-kohl mt-2">{formatINR(info.total)}</p>
            <p className="font-italic italic text-mitti mt-2">Final amount as verified by NEEJEE checkout.</p>
          </div>
        )}

        {statusMessage && (
          <div className={`mt-6 p-5 text-left border ${
            terminalState === 'refund' ? 'bg-banarasi/10 border-banarasi/40' :
            terminalState === 'manual' ? 'bg-madder/10 border-madder/30' :
            'bg-beige border-mitti/20'
          }`}>
            <div className="flex items-start gap-3">
              {terminalState === 'finalizing' ? <ShieldCheck className="w-5 h-5 text-madder mt-0.5" /> : <Check className="w-5 h-5 text-neem mt-0.5" />}
              <div>
                <p className="font-display text-lg text-kohl">{paymentCaptured ? 'Payment received.' : 'Payment status'}</p>
                <p className="font-ui text-sm text-mitti mt-1">{statusMessage}</p>
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

        {!paymentCaptured && terminalState === 'none' && (
          <button onClick={startPayment} disabled={!rzpReady || loading} className="btn-primary mt-8 disabled:opacity-50">
            {loading ? 'OPENING PAYMENT…' : rzpReady ? 'PAY NOW' : 'LOADING…'}
          </button>
        )}

        {paymentCaptured && terminalState === 'finalizing' && pendingVerification && (
          <button
            type="button"
            onClick={() => finalizePayment(pendingVerification, 1)}
            disabled={loading}
            className="btn-primary mt-8 disabled:opacity-50"
          >
            {loading ? 'CONFIRMING…' : 'RETRY ORDER CONFIRMATION'}
          </button>
        )}

        {(terminalState === 'refund' || terminalState === 'manual') && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/account" className="btn-outline">VIEW ACCOUNT</Link>
            <Link href="/" className="btn-outline">RETURN HOME</Link>
          </div>
        )}

        {!paymentCaptured && error && error.toLowerCase().includes('no longer available') && (
          <Link href="/cart" className="btn-outline mt-4 inline-block">REVIEW YOUR TRUNK</Link>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-mitti">
          <ShieldCheck className="w-4 h-4" />
          <p className="font-ui text-xs tracking-widest">SECURED BY RAZORPAY</p>
        </div>

        <p className="font-italic italic text-mitti text-sm mt-8 max-w-md mx-auto">
          Payment is completed in Razorpay Checkout. NEEJEE receives the payment reference and verifies it server-side before confirming your order.
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
