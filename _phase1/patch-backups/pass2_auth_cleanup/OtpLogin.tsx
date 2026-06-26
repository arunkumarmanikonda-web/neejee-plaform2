'use client';
import { useState, useEffect } from 'react';
import { Phone, Shield, Loader2 } from 'lucide-react';

export interface OtpLoginProps {
  purpose: 'login_customer' | 'login_seller' | 'login_vendor' | 'admin_2fa' | 'checkout_guest';
  title?: string;
  subtitle?: string;
  onVerified: (phone: string) => void | Promise<void>;
  initialPhone?: string;
  /**
   * If set, after OTP verifies, POST to /api/auth/otp/signin with this role
   * to create a session, then call onVerified for redirect.
   * Omit for use cases where the parent handles session creation itself
   * (e.g. checkout guest verification).
   */
  autoSignInAs?: 'customer' | 'seller' | 'vendor' | 'admin';
}

export default function OtpLogin({ purpose, title, subtitle, onVerified, initialPhone, autoSignInAs }: OtpLoginProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(initialPhone || '');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function requestCode() {
    setError(null); setInfo(null); setLoading(true); setDevCode(null);
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Failed to send OTP');
      } else {
        setStep('code');
        setResendIn(60);
        setInfo(`OTP sent to ${phone}. Valid for 5 minutes.`);
        if (data.devCode) setDevCode(data.devCode);
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, purpose }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Verification failed');
        setLoading(false);
        return;
      }
      // Optional: auto-create session for portal logins
      if (autoSignInAs) {
        const sRes = await fetch('/api/auth/otp/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, role: autoSignInAs, purpose }),
        });
        const sData = await sRes.json();
        if (!sRes.ok) {
          setError(sData?.error || 'Sign-in failed after verification');
          setLoading(false);
          return;
        }
      }
      await onVerified(phone);
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {title && <h2 className="font-display text-2xl text-kohl mb-1">{title}</h2>}
      {subtitle && <p className="font-ui text-sm text-kohl/60 mb-6">{subtitle}</p>}

      {step === 'phone' && (
        <div className="space-y-4">
          <div>
            <label className="block font-ui text-xs text-kohl/60 mb-1 uppercase tracking-wider">Mobile number</label>
            <div className="flex items-center border border-kohl/20 focus-within:border-madder">
              <Phone className="w-4 h-4 mx-3 text-kohl/40" />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1 py-3 pr-3 font-ui text-base bg-transparent outline-none"
                autoFocus
              />
            </div>
          </div>
          {error && <div className="font-ui text-sm text-red-700 bg-red-50 p-3">{error}</div>}
          <button
            onClick={requestCode}
            disabled={loading || !phone}
            className="w-full bg-madder text-white py-3 font-ui text-sm uppercase tracking-wider hover:bg-madder/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Send OTP
          </button>
        </div>
      )}

      {step === 'code' && (
        <div className="space-y-4">
          <div>
            <label className="block font-ui text-xs text-kohl/60 mb-1 uppercase tracking-wider">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center py-3 font-mono text-2xl tracking-[0.5em] border border-kohl/20 focus:border-madder outline-none"
              autoFocus
            />
            <div className="flex justify-between mt-2 font-ui text-xs text-kohl/60">
              <button onClick={() => setStep('phone')} className="hover:text-madder underline">Change number</button>
              <button
                onClick={requestCode}
                disabled={resendIn > 0 || loading}
                className="hover:text-madder underline disabled:opacity-50 disabled:no-underline"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
              </button>
            </div>
          </div>
          {info && <div className="font-ui text-xs text-kohl/70 bg-beige p-3">{info}</div>}
          {devCode && (
            <div className="font-ui text-xs text-amber-900 bg-amber-50 p-3">
              <strong>DEV ONLY:</strong> SMS not configured — code is <code className="font-mono">{devCode}</code>
            </div>
          )}
          {error && <div className="font-ui text-sm text-red-700 bg-red-50 p-3">{error}</div>}
          <button
            onClick={verify}
            disabled={loading || code.length !== 6}
            className="w-full bg-madder text-white py-3 font-ui text-sm uppercase tracking-wider hover:bg-madder/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Verify &amp; continue
          </button>
        </div>
      )}
    </div>
  );
}
