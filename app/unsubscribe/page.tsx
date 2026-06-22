'use client';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Check } from 'lucide-react';

export const dynamic = 'force-dynamic';

function UnsubscribeInner() {
  const params = useSearchParams();
  const email = params.get('email') || '';
  const cartId = params.get('cart') || '';
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');

  const confirm = async () => {
    setStatus('submitting');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cartId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setStatus('done');
    } catch (e: any) { setErr(e.message); setStatus('error'); }
  };

  return (
    <section className="max-w-xl mx-auto px-6 py-20 text-center">
      <p className="label text-madder">UNSUBSCRIBE</p>
      <h1 className="font-display text-4xl text-kohl mt-4">A quiet goodbye.</h1>

      {status === 'done' ? (
        <div className="mt-12 space-y-6">
          <div className="w-16 h-16 bg-neem text-ivory rounded-full mx-auto flex items-center justify-center">
            <Check className="w-8 h-8" />
          </div>
          <p className="font-italic italic text-mitti text-lg">
            Done. You will not receive marketing emails from us.
          </p>
          <p className="text-sm text-mitti">
            Transactional updates (order confirmations, shipping) will still reach you when you make a purchase.
          </p>
          <div className="pt-4">
            <Link href="/" className="btn-outline">RETURN HOME</Link>
          </div>
        </div>
      ) : (
        <div className="mt-12 space-y-6">
          {email && <p className="font-italic italic text-mitti">For: <strong>{email}</strong></p>}
          <p className="text-kohl">
            We will not be sad to let you go, only quietly so. Confirm and we will remove you from our marketing list right away.
          </p>
          <button onClick={confirm} disabled={status === 'submitting'} className="btn-primary">
            {status === 'submitting' ? 'PROCESSING...' : 'CONFIRM UNSUBSCRIBE'}
          </button>
          {err && <p className="text-madder text-sm">{err}</p>}
          <p className="pt-4 text-xs text-mitti">
            Or <Link href="/account" className="underline">manage preferences</Link> if you would like to adjust what we send instead.
          </p>
        </div>
      )}
    </section>
  );
}

export default function UnsubscribePage() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="p-20 text-center text-mitti">Loading...</div>}>
        <UnsubscribeInner />
      </Suspense>
      <Footer />
    </>
  );
}
