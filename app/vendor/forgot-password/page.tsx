'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';

export default function VendorForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/vendor/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setDone(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center p-4">
      <div className="bg-ivory max-w-sm w-full p-8 border border-mitti/15">
        <Link href="/vendor/login" className="inline-flex items-center gap-1 text-xs text-mitti hover:text-madder mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to sign in
        </Link>
        <h1 className="font-display text-2xl text-kohl mb-1 flex items-center gap-2">
          <Mail className="w-5 h-5 text-madder" /> Trouble signing in?
        </h1>
        <p className="text-xs text-mitti mb-6">Enter your email and we'll send you a fresh sign-in link.</p>

        {done ? (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm">
              If your email is registered with us, a sign-in link is on its way. Check your inbox in a minute or two.
            </div>
            <Link href="/vendor/login" className="block text-center text-xs uppercase tracking-widest text-madder hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-mitti">Email</span>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full text-xs disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'SEND SIGN-IN LINK'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
