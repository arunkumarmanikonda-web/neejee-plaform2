'use client';
import { useState } from 'react';
import { Loader2, Check, Mail } from 'lucide-react';

interface Props {
  productId: string;
  productName: string;
  source?: 'pdp' | 'drops-page' | 'sold-out-page';
  className?: string;
}

export function WaitlistSignup({ productId, productName, source = 'pdp', className = '' }: Props) {
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || done) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, email, whatsapp: whatsapp || undefined, source }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || 'Could not join the waitlist');
      } else {
        setDone(true);
        setMessage(d.message || `You are on the waitlist for ${productName}.`);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={`p-4 border border-neem/40 bg-neem/10 ${className}`}>
        <div className="flex items-start gap-2">
          <Check className="w-4 h-4 text-neem mt-0.5 flex-shrink-0" />
          <p className="text-sm font-display text-kohl">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`p-4 border border-madder/30 bg-beige/30 ${className}`}>
      <p className="font-display text-base text-kohl mb-1">Sold out for now.</p>
      <p className="text-xs italic text-mitti mb-3">
        Leave your email and we&apos;ll write the moment this piece is found again.
      </p>
      <div className="space-y-2">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={submitting}
          className="w-full p-2 bg-ivory border border-mitti/30 text-sm"
        />
        <input
          type="tel"
          value={whatsapp}
          onChange={e => setWhatsapp(e.target.value)}
          placeholder="WhatsApp number (optional)"
          disabled={submitting}
          className="w-full p-2 bg-ivory border border-mitti/30 text-sm"
        />
      </div>
      {error && <p className="text-xs text-madder mt-2">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !email}
        className="mt-3 w-full px-4 py-2 bg-madder text-ivory text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 inline-flex items-center justify-center gap-2"
      >
        {submitting
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
          : <><Mail className="w-4 h-4" /> Join the waitlist</>}
      </button>
    </form>
  );
}
