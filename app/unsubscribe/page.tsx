'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

function UnsubscribeInner() {
  const params = useSearchParams();
  const email = String(params.get('email') || '').trim().toLowerCase();
  const token = String(params.get('token') || '').trim();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const validLinkShape = /^\S+@\S+\.\S+$/.test(email) && token.length >= 32;

  const unsubscribe = async () => {
    if (!validLinkShape || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Unable to unsubscribe');
      setDone(true);
    } catch (e: any) {
      setError(e?.message || 'Unable to unsubscribe right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-xl mx-auto px-6 py-20 text-center">
      <p className="label text-madder">EMAIL PREFERENCES</p>
      <h1 className="font-display text-4xl text-kohl mt-3">Leave the trunk</h1>
      <p className="font-italic italic text-mitti mt-3">
        You can stop NEEJEE marketing messages without affecting transactional order updates.
      </p>
      <div className="madder-divider mx-auto mt-6" />

      {done ? (
        <div className="mt-10 bg-beige p-8">
          <p className="font-display text-2xl text-kohl">Preference updated.</p>
          <p className="font-body text-mitti mt-3">Marketing messages have been switched off for this address.</p>
          <Link href="/" className="btn-primary mt-6">RETURN HOME</Link>
        </div>
      ) : validLinkShape ? (
        <div className="mt-10 bg-beige p-8">
          <p className="font-body text-kohl break-all">{email}</p>
          <button type="button" onClick={unsubscribe} disabled={loading} className="btn-primary mt-6 disabled:opacity-50">
            {loading ? 'UPDATING…' : 'UNSUBSCRIBE'}
          </button>
          {error && <p role="alert" className="font-ui text-sm text-madder mt-4">{error}</p>}
        </div>
      ) : (
        <div className="mt-10 border border-mitti/20 p-8">
          <p className="font-body text-kohl">This unsubscribe link is incomplete or no longer valid.</p>
          <p className="font-body text-sm text-mitti mt-3">Use the unsubscribe link from a NEEJEE marketing email, or contact us to update your preferences.</p>
          <Link href="/help/contact" className="btn-outline mt-6">CONTACT NEEJEE</Link>
        </div>
      )}
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <>
      <Header />
      <Suspense fallback={<div className="py-20 text-center font-italic italic text-mitti">Loading…</div>}>
        <UnsubscribeInner />
      </Suspense>
      <Footer />
    </>
  );
}
