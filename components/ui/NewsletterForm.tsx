'use client';
import { useState } from 'react';

type NewsletterFormProps = {
  darkMode?: boolean;
  source?: string;
};

export function NewsletterForm({ darkMode = false, source = 'footer' }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Subscription failed');
      setDone(true);
      setEmail('');
    } catch {
      setError('We could not add you right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return <p className={`font-italic italic ${darkMode ? 'text-banarasi' : 'text-madder'}`}>Welcome to NEEJEE. Personally.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Your email"
        aria-label="Email address"
        className={`min-w-0 flex-1 px-4 py-3 font-ui text-sm ${darkMode ? 'bg-mitti/30 text-ivory placeholder-beige/40' : 'bg-ivory text-kohl border border-mitti/20 placeholder-mitti'}`}
      />
      <button
        type="submit"
        disabled={submitting}
        className="bg-madder text-ivory px-6 py-3 font-ui text-xs tracking-widest hover:bg-mitti transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? 'JOINING…' : 'JOIN'}
      </button>
      {error && <p role="alert" className="basis-full text-madder text-xs">{error}</p>}
    </form>
  );
}
