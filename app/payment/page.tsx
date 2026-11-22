'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { HouseHeading } from '@/components/checkout/HouseHeading';
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

  const opening = useRef(false);
  const captured = useRef(false);
  const checkoutMark = useRef('');
  useEffect(()=>{
    const controller = new AbortController();
    fetch('/brand/journey-apple.png',{signal:controller.signal}).then(async response=>{
      if (!response.ok) return;
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = ()=>{if (!controller.signal.aborted && typeof reader.result==='string') checkoutMark.current=reader.result;};
      reader.readAsDataURL(blob);
    }).catch(()=>{});
    return ()=>controller.abort();
  },[]);
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
    const controller = new AbortController();
    setInfo(null);
    setError('');
    if (!snapshotId && !orderNumber) { setError('Open payment from your bag to see the amount due.'); return; }
    const path = snapshotId ? '/api/checkout/snapshot/' + encodeURIComponent(snapshotId) : '/api/orders/' + encodeURIComponent(orderNumber!);
    fetch(path,{cache:'no-store',signal:controller.signal}).then(async response=>{
      if (!response.ok) throw Error('This checkout could not be opened. Return to your bag to review the pieces.');
      const data = await response.json();
      const row = snapshotId ? data.snapshot : data.order;
      if (!row || !Number.isSafeInteger(row.total) || row.total<=0) throw Error('The amount due could not be confirmed.');
      if (!snapshotId && row.paymentStatus==='PAID') throw Error('This order has already been paid.');
      if (!controller.signal.aborted) setInfo({total:row.total});
    }).catch(e=>{if (!controller.signal.aborted) setError(e.message);});
    return ()=>controller.abort();
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
    if (captured.current || opening.current || !info) return;
    if (!(window as any).Razorpay) {
      setError('Payment window is not ready. Please refresh this page.');
      return;
    }

    opening.current = true;
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
          opening.current = false;
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
        description: snapshotId ? 'Your Neejee order' : `Order ${data.orderNumber}`,
        image: checkoutMark.current || window.location.origin + '/brand/journey-apple.png',
        prefill: {
          email: info?.email || '',
          contact: info?.phone || '',
          name: info?.name || '',
        },
        theme: { color: '#8B2E2A' },
        handler: async (gatewayResponse: any) => {
          captured.current = true;
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
            if (captured.current) return;
            opening.current = false;
            setLoading(false);
            setError('You closed the payment window. Your bag is saved.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (e: any) {
      opening.current = false;
      setError(e.message || 'Unable to open payment');
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" onReady={() => setRzpReady(true)} onError={()=>setError("Payment services could not be reached. Refresh to try again.")} />
      <Header />
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <HouseHeading title="Review and pay" stage="Secure payment"/>
        {orderNumber && !snapshotId && <p className="font-italic italic text-mitti mt-3">{orderNumber}</p>}
        <div className="madder-divider mx-auto mt-6"></div>

        {info && (
          <div className="bg-beige p-8 mt-10 text-left">
            <p className="label text-madder">AMOUNT DUE</p>
            <p className="font-display text-4xl text-kohl mt-2">{formatINR(info.total)}</p>
            <p className="font-italic italic text-mitti mt-2">Includes the delivery and discount choices from checkout.</p>
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
          <button onClick={startPayment} disabled={!info || !rzpReady || loading} className="btn-primary mt-8 disabled:opacity-50">
            {loading ? 'OPENING PAYMENT…' : info && rzpReady ? 'Pay '+formatINR(info.total) : error ? 'Payment unavailable' : 'Loading payment…'}
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

        {!paymentCaptured && error && (
          <Link href="/cart" className="btn-outline mt-4 inline-block">RETURN TO BAG</Link>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-mitti">
          <ShieldCheck className="w-4 h-4" />
          <p className="font-ui text-xs tracking-widest">SECURED BY RAZORPAY</p>
        </div>

        <p className="font-italic italic text-mitti text-sm mt-8 max-w-md mx-auto">
          Your payment window opens with Razorpay. You’ll return here for your order confirmation.
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
