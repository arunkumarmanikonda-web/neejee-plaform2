'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Gift } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PhoneInput } from '@/components/ui/PhoneInput';

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center text-mitti font-italic italic">Loading...</div>}>
      <SignupInner />
    </Suspense>
  );
}

function SignupInner() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    marketingConsent: false,
    smsOptIn: false,
    whatsappOptIn: false,
    referralCode: '',
  });

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      try { localStorage.setItem('neejee.ref', ref); } catch {}
      setForm(f => ({ ...f, referralCode: ref }));
    } else {
      try {
        const stored = localStorage.getItem('neejee.ref');
        if (stored) setForm(f => ({ ...f, referralCode: stored }));
      } catch {}
    }
  }, [searchParams]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Phone already in E.164 from PhoneInput (e.g. +919876543210)
      if (!form.phone || form.phone.replace(/[^\d]/g, '').length < 8) {
        setLoading(false);
        setError('Please enter a valid mobile number');
        return;
      }

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Signup failed');
      }
      router.push('/account');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <section className="max-w-md mx-auto px-6 py-20">
        <p className="label text-madder text-center">YOUR PERSONAL ENTRANCE</p>
        <h1 className="font-display text-4xl text-kohl text-center mt-2">Create your account</h1>
        <p className="font-italic italic text-mitti text-center mt-3">Personal taste. Personal pace. Personal you.</p>
        <div className="madder-divider mx-auto mt-6 mb-12"></div>

        {form.referralCode && (
          <div className="bg-banarasi/10 border border-banarasi/40 p-4 mb-6 flex items-start gap-3">
            <Gift className="w-5 h-5 text-madder flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-display text-kohl">A friend sent you here.</p>
              <p className="font-italic italic text-mitti text-sm mt-1">
                Referral code <strong className="text-madder">{form.referralCode}</strong> applied. You’ll receive 10% off your first order.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <input
            required
            placeholder="Full name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm"
          />
          <input
            type="email"
            required
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm"
          />

          {/* Phone with country code */}
          <div>
            <PhoneInput
              value={form.phone}
              onChange={(full) => setForm({ ...form, phone: full })}
              required
              placeholder="Mobile number"
              defaultCountry="IN"
            />
            <p className="text-[10px] tracking-wider text-mitti/70 mt-1">
              We use this only for order updates and (if you choose) WhatsApp / SMS.
            </p>
          </div>

          {/* Password with show/hide */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              placeholder="Password (min 8 chars)"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full p-3 pr-12 bg-beige border border-mitti/20 font-ui text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mitti hover:text-kohl"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Update channel preferences */}
          <div className="border border-mitti/20 bg-beige/40 p-4 space-y-2.5">
            <p className="label text-mitti">HOW SHOULD WE REACH YOU</p>
            <p className="text-[11px] text-mitti/80 leading-relaxed">
              You always get order updates by email. Choose any extra channels you like.
            </p>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.whatsappOptIn}
                onChange={e => setForm({ ...form, whatsappOptIn: e.target.checked })}
                className="mt-0.5 accent-madder"
              />
              <span className="text-sm text-kohl">WhatsApp updates <span className="text-mitti/70">— shipping &amp; delivery</span></span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.smsOptIn}
                onChange={e => setForm({ ...form, smsOptIn: e.target.checked })}
                className="mt-0.5 accent-madder"
              />
              <span className="text-sm text-kohl">SMS alerts <span className="text-mitti/70">— OTPs &amp; delivery</span></span>
            </label>
          </div>

          {/* Marketing consent */}
          <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-beige/40 border border-mitti/20">
            <input
              type="checkbox"
              checked={form.marketingConsent}
              onChange={e => setForm({ ...form, marketingConsent: e.target.checked })}
              className="mt-0.5 accent-madder"
            />
            <span className="text-xs text-kohl/85 leading-relaxed">
              Send me quiet letters from NEEJEE — new drops, founder notes, and craft stories.
              You can unsubscribe in one tap, always.
            </span>
          </label>

          {error && <p className="font-ui text-xs text-madder">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'CREATING…' : 'CREATE TRUNK'}
          </button>
        </form>

        <p className="label text-monsoon mt-4 text-center">
          BY SIGNING UP YOU AGREE TO OUR <Link href="/legal/terms" className="underline">TERMS</Link> · <Link href="/legal/privacy" className="underline">PRIVACY</Link> · DPDP-COMPLIANT
        </p>
        <p className="font-italic italic text-mitti text-center mt-10">
          Already a member? <Link href="/login" className="text-madder underline">Sign in</Link>
        </p>
      </section>
      <Footer />
    </>
  );
}
