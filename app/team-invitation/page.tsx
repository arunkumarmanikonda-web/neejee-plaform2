'use client';

import { FormEvent, useEffect, useState } from 'react';

export default function TeamInvitation() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const value = window.location.hash.slice(1);
    setToken(value);
    if (!value) setError('Open the personal link from your invitation email.');
  }, []);
  async function accept(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/team-invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 422) setNeedsPassword(true);
        setError(result.error || 'Please try again.');
        return;
      }
      window.location.replace(result.destination);
    } catch {
      setError('Could not reach NEEJEE. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return <main className="min-h-screen bg-ivory flex items-center justify-center px-6"><form onSubmit={accept} className="max-w-md w-full space-y-5">
    <h1 className="font-display text-4xl">Join your NEEJEE team</h1>
    {needsPassword && <label className="block">Create your password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="block p-3 w-full border mt-2" /></label>}
    {error && <p aria-live="polite" className="text-madder">{error}</p>}
    <button disabled={!token || busy} className="btn-primary disabled:opacity-50">{busy ? 'Accepting…' : 'Accept invitation'}</button>
  </form></main>;
}
