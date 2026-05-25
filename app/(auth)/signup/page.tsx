'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Signup failed'); }
      router.push('/account');
      router.refresh();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <>
      <Header />
      <section className="max-w-md mx-auto px-6 py-20">
        <p className="label text-madder text-center">BEGIN YOUR TRUNK</p>
        <h1 className="font-display text-4xl text-kohl text-center mt-2">Create account</h1>
        <p className="font-italic italic text-mitti text-center mt-3">Two minutes. A lifetime of personal finding.</p>
        <div className="madder-divider mx-auto mt-6 mb-12"></div>
        <form onSubmit={submit} className="space-y-4">
          <input required placeholder="Full name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          <input type="email" required placeholder="Email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          <input type="password" required minLength={8} placeholder="Password (min 8 chars)" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          {error && <p className="font-ui text-xs text-madder">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">{loading ? 'CREATING...' : 'CREATE TRUNK'}</button>
        </form>
        <p className="label text-monsoon mt-4 text-center">BY SIGNING UP YOU AGREE TO OUR TERMS · PRIVACY · DPDP-COMPLIANT</p>
        <p className="font-italic italic text-mitti text-center mt-10">
          Already a member? <Link href="/login" className="text-madder underline">Sign in</Link>
        </p>
      </section>
      <Footer />
    </>
  );
}
