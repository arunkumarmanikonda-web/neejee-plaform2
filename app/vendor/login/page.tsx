'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, KeyRound, Mail, Smartphone } from 'lucide-react';
import OtpLogin from '@/components/auth/OtpLogin';

// We wrap the page in Suspense because useSearchParams() needs it during build.
export default function VendorLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>}>
      <VendorLoginInner />
    </Suspense>
  );
}

function VendorLoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const tokenInUrl = sp.get('token') || '';
  const [mode, setMode] = useState<'otp' | 'magic' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-consume magic token if present
  useEffect(() => {
    if (!tokenInUrl) return;
    (async () => {
      setLoading(true); setError('');
      try {
        const r = await fetch('/api/vendor/auth/magic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenInUrl }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || 'Magic link invalid');
        router.push('/vendor/dashboard');
      } catch (e: any) {
        setError(e.message || 'Magic link sign-in failed');
      } finally { setLoading(false); }
    })();
  }, [tokenInUrl, router]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const r = await fetch('/api/vendor/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Sign-in failed');
      router.push('/vendor/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const requestMagic = (e: React.FormEvent) => {
    e.preventDefault();
    setError('We don\'t send vendor magic-link emails automatically yet. Please ask your NEEJEE admin contact to send you a fresh link.');
  };

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center p-4">
      <div className="bg-ivory max-w-sm w-full p-8 border border-mitti/15">
        <h1 className="font-display text-2xl text-kohl mb-1">Vendor portal</h1>
        <p className="text-xs text-mitti mb-6">Sign in to manage your purchase orders.</p>

        {loading && tokenInUrl && (
          <p className="text-sm text-mitti italic mb-4"><Loader2 className="w-4 h-4 animate-spin inline" /> Signing you in…</p>
        )}

        {!tokenInUrl && (
          <>
            <div className="grid grid-cols-3 gap-1 mb-4">
              <button
                onClick={() => { setMode('otp'); setError(''); }}
                className={`text-[10px] uppercase tracking-widest py-2 border ${mode === 'otp' ? 'bg-madder text-ivory border-madder' : 'bg-beige border-mitti/20 text-mitti'}`}
              >
                <Smartphone className="w-3 h-3 inline mr-1" /> OTP
              </button>
              <button
                onClick={() => { setMode('magic'); setError(''); }}
                className={`text-[10px] uppercase tracking-widest py-2 border ${mode === 'magic' ? 'bg-madder text-ivory border-madder' : 'bg-beige border-mitti/20 text-mitti'}`}
              >
                <Mail className="w-3 h-3 inline mr-1" /> Magic
              </button>
              <button
                onClick={() => { setMode('password'); setError(''); }}
                className={`text-[10px] uppercase tracking-widest py-2 border ${mode === 'password' ? 'bg-madder text-ivory border-madder' : 'bg-beige border-mitti/20 text-mitti'}`}
              >
                <KeyRound className="w-3 h-3 inline mr-1" /> Password
              </button>
            </div>

            {mode === 'otp' ? (
              <OtpLogin
                purpose="login_vendor"
                autoSignInAs="vendor"
                subtitle="We'll text a 6-digit code to your registered mobile."
                onVerified={() => router.push('/vendor/dashboard')}
              />
            ) : mode === 'magic' ? (
              <form onSubmit={requestMagic} className="space-y-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-mitti">Email</span>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
                </label>
                <button type="submit" disabled={loading} className="btn-primary w-full text-xs disabled:opacity-50">
                  REQUEST MAGIC LINK
                </button>
                <p className="text-[10px] italic text-mitti">
                  We&apos;ll add automated email delivery in a future release. For now, your NEEJEE contact will send the link manually.
                </p>
              </form>
            ) : (
              <form onSubmit={submitPassword} className="space-y-3">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-mitti">Email</span>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-widest text-mitti">Password</span>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
                </label>
                <button type="submit" disabled={loading} className="btn-primary w-full text-xs disabled:opacity-50">
                  {loading ? 'Signing in…' : 'SIGN IN'}
                </button>
              </form>
            )}
          </>
        )}

        {error && <p className="mt-4 text-xs text-madder">{error}</p>}

        {!tokenInUrl && mode !== 'otp' && (
          <p className="mt-6 text-center">
            <a href="/vendor/forgot-password" className="text-xs text-mitti hover:text-madder">Forgot password?</a>
          </p>
        )}
      </div>
    </div>
  );
}
