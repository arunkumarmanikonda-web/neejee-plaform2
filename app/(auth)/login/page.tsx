'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      router.push('/account');
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <>
      <Header />
      <section className="max-w-md mx-auto px-6 py-20">
        <p className="label text-madder text-center">WELCOME BACK</p>
        <h1 className="font-display text-4xl text-kohl text-center mt-2">Sign in</h1>
        <div className="madder-divider mx-auto mt-4 mb-12"></div>
        <form onSubmit={submit} className="space-y-4">
          <input type="email" required placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          <input type="password" required placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          {error && <p className="font-ui text-xs text-madder">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">{loading ? 'SIGNING IN...' : 'SIGN IN'}</button>
        </form>
        <p className="text-center font-ui text-xs tracking-widest text-mitti mt-8">
          OR SIGN IN WITH OTP
        </p>
        <button className="btn-outline w-full mt-4">CONTINUE WITH PHONE OTP</button>
        <p className="font-italic italic text-mitti text-center mt-10">
          New to NEEJEE? <Link href="/signup" className="text-madder underline">Create your trunk</Link>
        </p>
      </section>
      <Footer />
    </>
  );
}
