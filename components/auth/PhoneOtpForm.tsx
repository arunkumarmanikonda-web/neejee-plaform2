'use client';
// components/auth/PhoneOtpForm.tsx
// v26.3b — Reusable phone+OTP form.
// Drop into both /login and /signup pages.

import { useState, useEffect } from 'react';

interface Props {
  purpose: 'login' | 'signup';
  onSuccess: (user: any) => void;
}

export default function PhoneOtpForm({ purpose, onSuccess }: Props) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function normalize(p: string): string {
    const digits = p.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    return p.startsWith('+') ? p : `+${digits}`;
  }

  async function requestOtp(isResend = false) {
    setError(null);
    setLoading(true);
    try {
      const phoneNormalized = normalize(phone);
      const url = isResend ? '/api/auth/otp/resend' : '/api/auth/otp/request';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNormalized, purpose }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not send OTP');
        if (data.cooldownSec) setCooldown(data.cooldownSec);
        return;
      }
      setStep('otp');
      setCooldown(data.cooldownSec || 60);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const phoneNormalized = normalize(phone);
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneNormalized,
          code,
          purpose,
          name: purpose === 'signup' ? name : undefined,
          email: purpose === 'signup' ? email : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'OTP verification failed');
        return;
      }
      onSuccess(data.user);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {step === 'phone' && (
        <form onSubmit={(e) => { e.preventDefault(); requestOtp(); }} className="space-y-4">
          {purpose === 'signup' && (
            <>
              <div>
                <label className="block text-xs uppercase tracking-widest text-mitti mb-1">Your name</label>
                <input
                  type="text" required
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="As you'd like to be addressed"
                  className="w-full border border-mitti/30 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-mitti mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="hello@example.com"
                  className="w-full border border-mitti/30 px-3 py-2.5 text-sm"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs uppercase tracking-widest text-mitti mb-1">Phone number</label>
            <input
              type="tel" required
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full border border-mitti/30 px-3 py-2.5 text-sm"
              autoFocus
            />
            <p className="text-xs text-mitti italic mt-1">We'll send a 6-digit code to verify.</p>
          </div>
          {error && <p className="text-sm text-madder bg-madder/10 px-3 py-2">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-kohl text-ivory py-3 text-sm uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? 'Sending…' : purpose === 'signup' ? 'Create account' : 'Continue'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={(e) => { e.preventDefault(); verifyOtp(); }} className="space-y-4">
          <div>
            <p className="text-sm text-kohl mb-1">We've sent a 6-digit code to</p>
            <p className="text-base font-medium text-kohl">{normalize(phone)}</p>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(null); }}
              className="text-xs text-madder underline mt-1"
            >Change number</button>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-mitti mb-1">Enter OTP</label>
            <input
              type="text" inputMode="numeric" pattern="\d{6}" maxLength={6} required
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="• • • • • •"
              className="w-full border border-mitti/30 px-3 py-3 text-lg tracking-[0.5em] text-center font-mono"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-madder bg-madder/10 px-3 py-2">{error}</p>}
          <button
            type="submit" disabled={loading || code.length !== 6}
            className="w-full bg-kohl text-ivory py-3 text-sm uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? 'Verifying…' : purpose === 'signup' ? 'Verify & create account' : 'Verify & log in'}
          </button>
          <div className="text-center">
            {cooldown > 0 ? (
              <p className="text-xs text-mitti italic">Resend in {cooldown}s</p>
            ) : (
              <button
                type="button"
                onClick={() => requestOtp(true)}
                disabled={loading}
                className="text-xs text-madder underline"
              >Resend OTP</button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
