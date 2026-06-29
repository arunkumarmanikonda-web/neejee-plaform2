'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft, Loader2, Smartphone, Mail } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { looksLikePhone, normalizePhone, formatPhoneDisplay } from '@/lib/phone';

export const dynamic = 'force-dynamic';

type Step = 'identity' | 'password' | 'otp' | 'admin_2fa';

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get('next') || '';

  const [step, setStep] = useState<Step>('identity');
  const [identifier, setIdentifier] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [resolvedPhone, setResolvedPhone] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAPhoneMask, setTwoFAPhoneMask] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [socialAvailable, setSocialAvailable] = useState<{ google: boolean; apple: boolean; facebook: boolean }>({
    google: false,
    apple: false,
    facebook: false,
  });
  const [facebookAppId, setFacebookAppId] = useState<string>('');
  const [otpEnabled, setOtpEnabled] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/auth/social/availability', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setSocialAvailable({
            google: !!d.google,
            apple: !!d.apple,
            facebook: !!d.facebook,
          });
          if (d.facebookAppId) setFacebookAppId(d.facebookAppId);
          setOtpEnabled(!!d.otpEnabled);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  const onIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const cleaned = identifier.trim();

      if (cleaned.includes('@')) {
        setResolvedEmail(cleaned.toLowerCase());
        setStep('password');
        return;
      }

      if (looksLikePhone(cleaned) || /^\d/.test(cleaned)) {
        if (!otpEnabled) {
          setError('Mobile sign-in is coming soon. Please use your email, or continue with Google.');
          return;
        }

        const candidate = cleaned.startsWith('+')
          ? cleaned
          : `${countryCode}${cleaned.replace(/[^\d]/g, '')}`;

        const e164 = normalizePhone(candidate);
        if (!e164) {
          setError('Please enter a valid mobile number.');
          return;
        }

        setResolvedPhone(e164);
        await sendOtp(e164);
        return;
      }

      setError(otpEnabled ? 'Type your email or your mobile number.' : 'Please enter your email address.');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (phone: string) => {
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'login_customer' }),
      });

      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(d.error || "We couldn't send the code. Please try again.");
        return;
      }

      setStep('otp');
      setResolvedPhone(d.phone || phone);
      setResendCountdown(45);
      setInfo(`Code sent to ${formatPhoneDisplay(phone)}.`);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resolvedEmail, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.requires2FA) {
        setTwoFAPhoneMask(data.phoneMask || '');
        setStep('admin_2fa');
        setInfo(`A 6-digit security code has been sent to ${data.phoneMask}. Enter it to finish signing in.`);
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        return;
      }

      const dest = nextParam || data.redirect || '/account';
      router.push(dest);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to sign in right now');
    } finally {
      setLoading(false);
    }
  };

  const on2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resolvedEmail, password, code: twoFACode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Invalid 2FA code');
        return;
      }

      const dest = nextParam || data.redirect || '/admin';
      router.push(dest);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to verify the security code');
    } finally {
      setLoading(false);
    }
  };

  const onOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: resolvedPhone, code: otp, purpose: 'login_customer' }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Invalid OTP');
        return;
      }

      const dest = nextParam || data.redirect || '/account';
      router.push(dest);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google', token: credential }),
      });

      const d = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(d.error || 'Google sign-in failed');
        return;
      }

      router.push(nextParam || d.redirect || '/account');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [googleClientId, setGoogleClientId] = useState<string>('');

  useEffect(() => {
    if (!socialAvailable.google) return;

    fetch('/api/auth/social/availability', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.googleClientId) setGoogleClientId(d.googleClientId);
      })
      .catch(() => {});
  }, [socialAvailable.google]);

  useEffect(() => {
    if (!socialAvailable.google || step !== 'identity') return;
    if (typeof window === 'undefined') return;
    if (!googleClientId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const tryRender = () => {
      if (cancelled) return;

      const w: any = window;
      if (!w.google?.accounts?.id || !googleBtnRef.current) {
        if (attempts++ < maxAttempts) {
          setTimeout(tryRender, 300);
        }
        return;
      }

      try {
        w.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (resp: any) => handleGoogleCredential(resp.credential),
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
        });

        googleBtnRef.current.innerHTML = '';
        w.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 340,
        });
      } catch (e: any) {
        console.warn('[google] renderButton failed:', e?.message);
      }
    };

    tryRender();
    return () => {
      cancelled = true;
    };
  }, [socialAvailable.google, step, googleClientId]);

  const startFacebook = () => {
    const w: any = window;

    if (!w.FB) {
      setError('Facebook sign-in is loading. Please try again in a moment.');
      return;
    }

    w.FB.login(
      async (resp: any) => {
        const token = resp?.authResponse?.accessToken;
        if (!token) {
          setError('Facebook login cancelled');
          return;
        }

        setLoading(true);

        try {
          const r = await fetch('/api/auth/social', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'facebook', token }),
          });

          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            setError(d.error || 'Facebook sign-in failed');
            return;
          }

          router.push(nextParam || d.redirect || '/account');
          router.refresh();
        } catch (err: any) {
          setError(err.message || 'Facebook sign-in failed');
        } finally {
          setLoading(false);
        }
      },
      { scope: 'public_profile,email' }
    );
  };

  return (
    <>
      {socialAvailable.google && (
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      )}

      {socialAvailable.facebook && facebookAppId && (
        <Script id="fb-sdk" strategy="afterInteractive">
          {`
            window.fbAsyncInit = function() {
              FB.init({ appId: '${facebookAppId}', cookie: true, xfbml: false, version: 'v18.0' });
            };
            (function(d, s, id) {
              var js, fjs = d.getElementsByTagName(s)[0];
              if (d.getElementById(id)) return;
              js = d.createElement(s); js.id = id;
              js.src = 'https://connect.facebook.net/en_US/sdk.js';
              fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
          `}
        </Script>
      )}

      <div className="space-y-4 max-w-sm mx-auto w-full">
        {step === 'identity' && (
          <IdentityField
            identifier={identifier}
            setIdentifier={setIdentifier}
            countryCode={countryCode}
            setCountryCode={setCountryCode}
            onSubmit={onIdentitySubmit}
            loading={loading}
            error={error}
            otpEnabled={otpEnabled}
          />
        )}

        {step === 'password' && (
          <form onSubmit={onPasswordSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setStep('identity');
                setError('');
                setInfo('');
              }}
              className="inline-flex items-center gap-1 text-xs text-mitti hover:text-madder"
            >
              <ArrowLeft className="w-3 h-3" /> Use a different account
            </button>

            <div className="flex items-center gap-2 text-sm text-kohl">
              <Mail className="w-4 h-4 text-madder" /> {resolvedEmail}
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            {error && <p className="font-ui text-xs text-madder">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Signing in...' : 'SIGN IN'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={onOtpSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setStep('identity');
                setError('');
                setInfo('');
              }}
              className="inline-flex items-center gap-1 text-xs text-mitti hover:text-madder"
            >
              <ArrowLeft className="w-3 h-3" /> Use a different number
            </button>

            <div className="flex items-center gap-2 text-sm text-kohl">
              <Smartphone className="w-4 h-4 text-madder" /> {formatPhoneDisplay(resolvedPhone)}
            </div>

            {info && <p className="text-xs italic text-mitti">{info}</p>}

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              placeholder="6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, ''))}
              className="w-full p-3 bg-beige border border-mitti/20 font-ui text-lg tracking-[0.5em] text-center"
            />

            {error && <p className="font-ui text-xs text-madder">{error}</p>}

            <button type="submit" disabled={loading || otp.length < 4} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Verifying...' : 'VERIFY & SIGN IN'}
            </button>

            <button
              type="button"
              disabled={resendCountdown > 0 || loading}
              onClick={() => sendOtp(resolvedPhone)}
              className="w-full text-xs text-mitti hover:text-madder disabled:opacity-50"
            >
              {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
            </button>
          </form>
        )}

        {step === 'admin_2fa' && (
          <form onSubmit={on2FASubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setStep('password');
                setError('');
                setInfo('');
                setTwoFACode('');
              }}
              className="inline-flex items-center gap-1 text-xs text-mitti hover:text-madder"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>

            <div className="flex items-center gap-2 text-sm text-kohl">
              <Smartphone className="w-4 h-4 text-madder" /> 2FA code sent to {twoFAPhoneMask}
            </div>

            {info && <p className="text-xs italic text-mitti">{info}</p>}

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              placeholder="6-digit code"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/[^\d]/g, ''))}
              className="w-full p-3 bg-beige border border-mitti/20 font-ui text-lg tracking-[0.5em] text-center"
            />

            {error && <p className="font-ui text-xs text-madder">{error}</p>}

            <button type="submit" disabled={loading || twoFACode.length < 4} className="btn-primary w-full disabled:opacity-50">
              {loading ? 'Verifying...' : 'VERIFY & SIGN IN'}
            </button>
          </form>
        )}

        {step === 'identity' && (socialAvailable.google || socialAvailable.facebook) && (
          <>
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-mitti/20"></div>
              <span className="text-[10px] uppercase tracking-widest text-mitti">Or continue with</span>
              <div className="flex-1 h-px bg-mitti/20"></div>
            </div>

            <div className="space-y-2">
              {socialAvailable.google && <div ref={googleBtnRef} className="flex justify-center" />}

              {socialAvailable.facebook && (
                <button
                  onClick={startFacebook}
                  disabled={loading}
                  type="button"
                  className="w-full p-3 bg-[#1877F2] text-white text-sm font-ui hover:opacity-90 inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Continue with Facebook
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <>
      <Header />
      <section className="max-w-md mx-auto px-6 py-20">
        <p className="label text-madder text-center">WELCOME BACK</p>
        <h1 className="font-display text-4xl text-kohl text-center mt-2">Sign in</h1>
        <p className="font-italic italic text-mitti text-center mt-2">A quieter way in.</p>
        <div className="madder-divider mx-auto mt-4 mb-10"></div>

        <Suspense fallback={<div className="font-ui text-xs text-mitti text-center">Loading...</div>}>
          <LoginInner />
        </Suspense>

        <p className="font-italic italic text-mitti text-center mt-10">
          New to NEEJEE?{' '}
          <Link href="/signup" className="text-madder underline">
            Create your trunk
          </Link>
        </p>
      </section>
      <Footer />
    </>
  );
}

const COUNTRY_CODES: Array<{ code: string; label: string }> = [
  { code: '+91', label: 'India' },
  { code: '+1', label: 'USA / Canada' },
  { code: '+44', label: 'UK' },
  { code: '+971', label: 'UAE' },
  { code: '+65', label: 'Singapore' },
  { code: '+61', label: 'Australia' },
  { code: '+49', label: 'Germany' },
  { code: '+33', label: 'France' },
];

function IdentityField({
  identifier,
  setIdentifier,
  countryCode,
  setCountryCode,
  onSubmit,
  loading,
  error,
  otpEnabled,
}: {
  identifier: string;
  setIdentifier: (v: string) => void;
  countryCode: string;
  setCountryCode: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string;
  otpEnabled: boolean;
}) {
  const isEmail = identifier.includes('@');
  const isPhone = !isEmail && identifier.length > 0 && /^\+?\d/.test(identifier.trim());

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-[10px] uppercase tracking-widest text-mitti">
          {otpEnabled ? 'Mobile or email' : 'Email'}
        </span>

        <div className="mt-1 flex">
          {otpEnabled && isPhone && (
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="bg-beige border border-mitti/20 border-r-0 font-ui text-sm py-3 pl-2 pr-1 focus:outline-none"
              aria-label="Country code"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.code})
                </option>
              ))}
            </select>
          )}

          <input
            type={otpEnabled ? 'text' : 'email'}
            inputMode={otpEnabled ? (isEmail ? 'email' : isPhone ? 'tel' : 'text') : 'email'}
            required
            autoFocus
            placeholder={otpEnabled ? '9876543210 or you@email.com' : 'you@email.com'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="flex-1 p-3 bg-beige border border-mitti/20 font-ui text-sm"
          />
        </div>

        {otpEnabled && isPhone && (
          <p className="text-[10px] italic text-mitti/70 mt-1">
            Default {countryCode}. Change the dial code above if you are outside India.
          </p>
        )}

        {!otpEnabled && (
          <p className="text-[10px] italic text-mitti/70 mt-1">
            Mobile sign-in is coming soon. Use your email or continue with Google below.
          </p>
        )}
      </label>

      {error && (
        <div className="font-ui text-xs text-madder bg-madder/5 border border-madder/30 p-2 whitespace-pre-line">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading || !identifier.trim()} className="btn-primary w-full disabled:opacity-50">
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Continuing...
          </span>
        ) : (
          'CONTINUE'
        )}
      </button>
    </form>
  );
}
