'use client';
/**
 * Seller Studio login — canonical seller onboarding points to /sell/apply
 */
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, ShieldCheck, Store, Sparkles } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const dynamic = 'force-dynamic';

const SELLER_ROLES = ['SELLER', 'SELLER_STAFF', 'ADMIN', 'SUPER_ADMIN'];

export default function SellerLoginPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <div className="py-24 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-madder" />
          </div>
        </PageShell>
      }
    >
      <SellerLoginInner />
    </Suspense>
  );
}

function SellerLoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const notSeller = sp?.get('notseller') === '1';
  const applied = sp?.get('applied') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNeedsOnboarding(false);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || 'Invalid credentials. Please try again.');
        return;
      }

      const role = data?.role || '';
      if (SELLER_ROLES.includes(role)) {
        router.push('/seller/dashboard');
        router.refresh();
      } else {
        setNeedsOnboarding(true);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      {notSeller && !needsOnboarding && (
        <div className="max-w-xl mx-auto -mt-2 mb-8 bg-haldi/15 border-l-4 border-haldi p-4 text-sm text-kohl">
          <p className="font-display text-lg text-kohl">You&apos;re signed in, but not yet a seller.</p>
          <p className="mt-1 font-italic italic text-mitti">
            Seller Studio is by application. Begin yours below and we&apos;ll review it within a week.
          </p>
          <Link
            href="/sell/apply"
            className="mt-3 inline-flex items-center gap-2 text-xs tracking-widest text-madder hover:text-kohl underline underline-offset-4"
          >
            BEGIN APPLICATION <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {applied && (
        <div className="max-w-xl mx-auto -mt-2 mb-8 bg-neem/10 border-l-4 border-neem p-4 text-sm text-kohl">
          <p className="font-display text-lg text-kohl">Application received.</p>
          <p className="mt-1 font-italic italic text-mitti">
            We&apos;ll write back personally within a week. Once approved, sign in here to access Seller Studio.
          </p>
        </div>
      )}

      <div className="max-w-xl mx-auto px-6 pt-8 pb-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-madder/10 text-madder text-[10px] tracking-[0.25em]">
            <Store className="w-3 h-3" /> SELLER STUDIO
          </div>
          <h1 className="font-display text-5xl text-kohl mt-5 leading-tight">Seller Sign in</h1>
          <p className="font-italic italic text-mitti mt-2">For artisans, studios, and ateliers on NEEJEE.</p>
          <div className="madder-divider mx-auto mt-6"></div>
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-3">
          <Link
            href="/sell/apply"
            className="group bg-beige p-5 hover:bg-madder/5 transition border border-transparent hover:border-madder/30"
          >
            <p className="label text-madder flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> NEW TO NEEJEE
            </p>
            <p className="font-display text-xl text-kohl mt-2 leading-snug">Apply to sell with us</p>
            <p className="font-body text-sm text-kohl/70 mt-2">
              A short form. KYC, GST, bank — collected like Razorpay, once.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs tracking-widest text-madder group-hover:gap-2.5 transition-all">
              BEGIN APPLICATION <ArrowRight className="w-3 h-3" />
            </span>
          </Link>

          <Link
            href="/sellers"
            className="group bg-ivory p-5 hover:bg-beige/50 transition border border-mitti/15"
          >
            <p className="label text-mitti flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> WHAT WE OFFER
            </p>
            <p className="font-display text-xl text-kohl mt-2 leading-snug">Why NEEJEE?</p>
            <p className="font-body text-sm text-kohl/70 mt-2">
              Curated catalogue, weekly payouts, story-first listings, AI tools.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs tracking-widest text-kohl group-hover:gap-2.5 transition-all">
              READ MORE <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>

        <div className="mt-12 mb-8 flex items-center gap-3">
          <div className="flex-1 h-px bg-mitti/20"></div>
          <span className="text-[10px] tracking-[0.25em] text-mitti">EXISTING SELLER · SIGN IN</span>
          <div className="flex-1 h-px bg-mitti/20"></div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label text-mitti">EMAIL</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourstudio.in"
              disabled={loading || needsOnboarding}
              className="w-full mt-1 p-3 bg-ivory border border-mitti/25 font-ui text-sm focus:outline-none focus:border-madder"
            />
          </div>

          <div>
            <label htmlFor="password" className="label text-mitti">PASSWORD</label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || needsOnboarding}
                className="w-full p-3 pr-10 bg-ivory border border-mitti/25 font-ui text-sm focus:outline-none focus:border-madder"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mitti hover:text-kohl"
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-2 text-right">
              <Link
                href="/forgot-password?role=seller"
                className="text-xs text-mitti hover:text-madder underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="bg-madder/10 border-l-4 border-madder p-3 text-sm text-madder">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || needsOnboarding || !email || !password}
            className="w-full py-3 bg-madder text-ivory font-ui text-sm tracking-widest hover:bg-madder/90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> SIGNING IN
              </>
            ) : (
              <>SIGN IN TO SELLER STUDIO</>
            )}
          </button>
        </form>

        {needsOnboarding && (
          <div className="mt-6 bg-haldi/15 border-l-4 border-haldi p-5">
            <p className="font-display text-xl text-kohl">This email is a customer account.</p>
            <p className="font-italic italic text-mitti mt-1">
              You&apos;re signed in — but you don&apos;t have Seller Studio access yet. Apply with the same email and our team will review your studio within a week.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/sell/apply"
                className="px-4 py-2 bg-madder text-ivory text-xs tracking-widest inline-flex items-center gap-2"
              >
                BEGIN SELLER APPLICATION <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                href="/account"
                className="text-xs tracking-widest text-kohl hover:text-madder underline-offset-4 hover:underline"
              >
                Go to my customer account →
              </Link>
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-xs text-mitti">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-madder">
            <ArrowLeft className="w-3 h-3" /> Back to shop
          </Link>
          <span>
            Customer?{' '}
            <Link href="/login" className="text-kohl hover:text-madder underline underline-offset-4">
              Sign in here
            </Link>
          </span>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[70vh] bg-ivory">{children}</main>
      <Footer />
    </>
  );
}