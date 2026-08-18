'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const dynamic = 'force-dynamic';

export default function SellerActivatePage() {
  return (
    <Suspense fallback={<PageShell><div className="mx-auto max-w-xl px-6 py-20 text-sm text-mitti">Loading secure activation…</div></PageShell>}>
      <SellerActivateInner />
    </Suspense>
  );
}

function SellerActivateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sellerId = params?.get('sellerId') || '';
  const token = params?.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!sellerId || !token) {
      setError('This activation link is incomplete. Please use the link from your NEEJEE approval email.');
      return;
    }
    if (password.length < 10) {
      setError('Choose a password with at least 10 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/seller/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Seller Studio activation failed.');

      setDone(true);
      window.setTimeout(() => {
        router.push('/seller/login?activated=1');
        router.refresh();
      }, 1000);
    } catch (e: any) {
      setError(e?.message || 'Seller Studio activation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <main className="min-h-[70vh] bg-ivory px-6 py-16">
        <div className="mx-auto max-w-xl border border-mitti/20 bg-white p-8">
          <p className="label text-madder">SELLER STUDIO</p>
          <h1 className="mt-3 font-display text-4xl text-kohl">Activate your seller access</h1>
          <p className="mt-3 font-body text-sm leading-7 text-mitti">
            Create a private Seller Studio password. NEEJEE will never send or display your permanent password by email.
          </p>

          {done ? (
            <div className="mt-8 border border-neem/30 bg-neem/10 p-5 text-sm text-kohl">
              Seller Studio activated. Taking you to sign in…
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-5">
              <div>
                <label className="label text-mitti" htmlFor="seller-password">NEW PASSWORD</label>
                <input
                  id="seller-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full border border-mitti/25 bg-ivory p-3 text-sm outline-none focus:border-madder"
                />
              </div>
              <div>
                <label className="label text-mitti" htmlFor="seller-password-confirm">CONFIRM PASSWORD</label>
                <input
                  id="seller-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full border border-mitti/25 bg-ivory p-3 text-sm outline-none focus:border-madder"
                />
              </div>

              {error ? <div className="border-l-4 border-madder bg-madder/10 p-3 text-sm text-madder">{error}</div> : null}

              <button
                type="submit"
                disabled={loading || !sellerId || !token || !password || !confirmPassword}
                className="w-full bg-kohl py-3 text-sm tracking-widest text-ivory disabled:opacity-40"
              >
                {loading ? 'ACTIVATING…' : 'ACTIVATE SELLER STUDIO'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center text-xs text-mitti">
            Already activated? <Link href="/seller/login" className="text-kohl underline underline-offset-4">Sign in to Seller Studio</Link>
          </div>
        </div>
      </main>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
