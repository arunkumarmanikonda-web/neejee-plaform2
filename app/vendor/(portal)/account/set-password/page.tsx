'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const welcome = sp.get('welcome') === '1';
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      if (pwd.length < 8) throw new Error('Password must be at least 8 characters');
      if (pwd !== pwd2) throw new Error('Passwords do not match');
      const r = await fetch('/api/vendor/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setPassword: true, password: pwd }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Could not set password');
      router.push('/vendor/dashboard');
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-ivory max-w-sm w-full p-8 border border-mitti/15 space-y-4">
        <h1 className="font-display text-2xl text-kohl">{welcome ? 'Welcome to NEEJEE' : 'Set a password'}</h1>
        <p className="text-xs text-mitti">
          {welcome
            ? 'Optional — set a password so you can sign in directly without a magic link.'
            : 'Set or change your portal password.'}
        </p>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-mitti">New password (8+ chars)</span>
          <input type="password" required minLength={8} value={pwd} onChange={e => setPwd(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-widest text-mitti">Confirm password</span>
          <input type="password" required minLength={8} value={pwd2} onChange={e => setPwd2(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
        </label>
        {err && <p className="text-xs text-madder">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="btn-primary text-xs flex-1 disabled:opacity-50">
            {loading ? 'Saving…' : 'SAVE PASSWORD'}
          </button>
          {welcome && (
            <button type="button" onClick={() => router.push('/vendor/dashboard')} className="btn-ghost text-xs">
              SKIP
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
