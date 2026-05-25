'use client';
import { useState } from 'react';

export function NewsletterForm({ darkMode = false }: { darkMode?: boolean }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'footer' }),
      });
      if (!res.ok) throw new Error('Subscription failed');
      setDone(true);
      setEmail('');
    } catch { setError('Please check your email.'); }
  };

  if (done) {
    return <p className={`font-italic italic ${darkMode ? 'text-banarasi' : 'text-madder'}`}>Welcome to NEEJEE. Personally.</p>;
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Your email"
        className={`flex-1 px-4 py-3 font-ui text-sm ${darkMode ? 'bg-mitti/30 text-ivory placeholder-beige/40' : 'bg-ivory text-kohl border border-mitti/20 placeholder-mitti'}`}
      />
      <button type="submit" className="bg-madder text-ivory px-6 font-ui text-xs tracking-widest hover:bg-mitti transition-colors">JOIN</button>
      {error && <p className="text-madder text-xs">{error}</p>}
    </form>
  );
}
