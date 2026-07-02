'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PhoneInput } from '@/components/ui/PhoneInput';

type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  marketingConsent?: boolean;
  smsOptIn?: boolean;
  whatsappOptIn?: boolean;
  emailOptIn?: boolean;
};

function isPlaceholderEmail(email?: string | null, phone?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return true;

  if (/^user_\d+@neejee\.local$/.test(normalized)) return true;
  if (/^\d+@phone\.neejee\.com$/.test(normalized)) return true;

  const digits = String(phone || '').replace(/\D/g, '');
  if (digits) {
    if (normalized === `user_${digits}@neejee.local`) return true;
    if (normalized === `${digits}@phone.neejee.com`) return true;
  }

  return false;
}

function needsProfileCompletion(user?: Partial<SessionUser> | null) {
  if (!user) return true;

  const name = String(user.name || '').trim().toLowerCase();

  if (!name) return true;
  if (name === 'customer' || name === 'user' || name === 'guest') return true;
  if (isPlaceholderEmail(user.email, user.phone)) return true;

  return false;
}

function CompleteProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get('next') || '/account';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(true);

  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/me', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (!res.ok) {
          router.replace('/login?next=/complete-profile');
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (!data.user) {
          router.replace('/login?next=/complete-profile');
          return;
        }

        const currentUser: SessionUser = {
          id: data.id || data.user.id,
          email: data.email || data.user.email,
          name: data.name || data.user.name,
          phone: data.phone || data.user.phone,
          role: data.role || data.user.role,
          marketingConsent: data.marketingConsent ?? data.user.marketingConsent,
          smsOptIn: data.smsOptIn ?? data.user.smsOptIn,
          whatsappOptIn: data.whatsappOptIn ?? data.user.whatsappOptIn,
          emailOptIn: data.emailOptIn ?? data.user.emailOptIn,
        };

        setUser(currentUser);
        setName(currentUser.name || '');
        setEmail(currentUser.email || '');
        setPhone(currentUser.phone || '');
        setMarketingConsent(!!currentUser.marketingConsent);
        setSmsOptIn(!!currentUser.smsOptIn);
        setWhatsappOptIn(!!currentUser.whatsappOptIn);
        setEmailOptIn(currentUser.emailOptIn ?? true);
      } catch {
        router.replace('/login?next=/complete-profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const incomplete = useMemo(() => {
    return needsProfileCompletion({
      email,
      name,
      phone,
    });
  }, [email, name, phone]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMsg('');

    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          name,
          email,
          phone,
          marketingConsent,
          smsOptIn,
          whatsappOptIn,
          emailOptIn,
        }),
      });

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error('Save failed. Please try again.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Unable to save profile right now');
      }

      if (data.user) {
        setUser(data.user);
      }

      setMsg('Saved. Taking you to your trunk…');

      setTimeout(() => {
        router.push(nextParam || '/account');
        router.refresh();
      }, 250);
    } catch (err: any) {
      setError(err.message || 'Unable to save profile right now');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="font-italic italic text-mitti">Opening your profile…</p>
      </section>
    );
  }

  return (
    <section className="max-w-2xl mx-auto px-6 py-16">
      {!incomplete && (
        <Link
          href="/account"
          className="inline-flex items-center gap-2 text-xs text-mitti hover:text-madder mb-6"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to account
        </Link>
      )}

      <p className="label text-madder">
        {incomplete ? 'COMPLETE YOUR PROFILE' : 'UPDATE PROFILE'}
      </p>

      <h1 className="font-display text-4xl text-kohl mt-2">
        {incomplete ? 'One last detail.' : 'Your profile.'}
      </h1>

      <p className="font-italic italic text-mitti mt-2">
        {incomplete
          ? 'Add your real name and email before we take you into your trunk.'
          : 'Update the details we use for your orders, notes, and sign-in.'}
      </p>

      <div className="madder-divider mt-4 mb-8"></div>

      {user && isPlaceholderEmail(user.email, user.phone) && (
        <div className="mb-6 border border-madder/30 bg-madder/5 p-4 text-sm text-kohl">
          You signed in with your phone number. Please replace the temporary email with your real email address now.
        </div>
      )}

      <form onSubmit={save} className="space-y-5 max-w-xl">
        <label className="block">
          <span className="label">NAME</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
            placeholder="Your name"
            required
          />
        </label>

        <label className="block">
          <span className="label">EMAIL</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
            placeholder="you@example.com"
            required
          />
        </label>

        <div>
          <span className="label">PHONE</span>
          <div className="mt-1">
            <PhoneInput value={phone} onChange={setPhone} defaultCountry="IN" />
          </div>
        </div>

        <div className="border border-mitti/20 bg-beige/40 p-4 space-y-3">
          <p className="label text-mitti">REACH PREFERENCES</p>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              className="accent-madder"
            />
            <span className="text-sm text-kohl">WhatsApp — shipping & delivery</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
              className="accent-madder"
            />
            <span className="text-sm text-kohl">SMS — OTPs & alerts</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={emailOptIn}
              onChange={(e) => setEmailOptIn(e.target.checked)}
              className="accent-madder"
            />
            <span className="text-sm text-kohl">Email — order notes and updates</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={marketingConsent}
              onChange={(e) => setMarketingConsent(e.target.checked)}
              className="accent-madder"
            />
            <span className="text-sm text-kohl">Marketing letters — new drops, stories</span>
          </label>
        </div>

        {error && (
          <div className="font-ui text-xs text-madder bg-madder/5 border border-madder/30 p-3 whitespace-pre-line">
            {error}
          </div>
        )}

        {msg && <p className="text-xs text-neem">{msg}</p>}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-50 min-w-[220px]"
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              SAVING…
            </span>
          ) : incomplete ? (
            'SAVE & CONTINUE'
          ) : (
            'SAVE CHANGES'
          )}
        </button>
      </form>
    </section>
  );
}

export default function CompleteProfilePage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <section className="max-w-2xl mx-auto px-6 py-20 text-center">
            <p className="font-italic italic text-mitti">Opening your profile…</p>
          </section>
        }
      >
        <CompleteProfileInner />
      </Suspense>
      <Footer />
    </>
  );
}
