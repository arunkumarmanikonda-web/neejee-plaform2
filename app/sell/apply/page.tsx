'use client';

import { useState } from 'react';

type SubmitResult = {
  sellerId: string;
  kycStatus: string;
  autoValidation: {
    ok: boolean;
    errors: string[];
    checks: {
      pan: boolean;
      gstin: boolean;
      gstMatchesPan: boolean;
      cin: boolean;
      ifsc: boolean;
      bankAccount: boolean;
    };
  };
};

export default function SellerApplyPage() {
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    phoneOtpCode: '',
    craft: '',
    region: '',
    cluster: '',
    story: '',
    yearsOfPractice: '',
    pan: '',
    gstin: '',
    cin: '',
    bankAccount: '',
    ifsc: '',
    bankName: '',
  });

  const [loading, setLoading] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [emailOtp, setEmailOtp] = useState('');

  function patch(key: string, value: string) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function requestPhoneOtp() {
    setSendingPhoneOtp(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/seller/application/request-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, recipientName: form.contactName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send OTP');
      setMsg('Phone OTP sent');
    } catch (e: any) {
      setErr(e?.message || 'Failed to send OTP');
    } finally {
      setSendingPhoneOtp(false);
    }
  }

  async function submitApplication() {
    setLoading(true);
    setErr('');
    setMsg('');
    try {
      const payload = {
        ...form,
        yearsOfPractice: form.yearsOfPractice ? Number(form.yearsOfPractice) : null,
        portfolio: [],
      };

      const res = await fetch('/api/seller/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to submit application');

      setResult(data);
      setMsg('Application submitted. Email OTP sent.');
    } catch (e: any) {
      setErr(e?.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  }

  async function resendEmailOtp() {
    if (!result?.sellerId) return;
    setSendingEmailOtp(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/seller/application/request-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: result.sellerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to send email OTP');
      setMsg('Email OTP sent');
    } catch (e: any) {
      setErr(e?.message || 'Failed to send email OTP');
    } finally {
      setSendingEmailOtp(false);
    }
  }

  async function verifyEmailOtp() {
    if (!result?.sellerId) return;
    setVerifyingEmailOtp(true);
    setErr('');
    setMsg('');
    try {
      const res = await fetch('/api/seller/application/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: result.sellerId, code: emailOtp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.reason || 'Failed to verify email OTP');
      setMsg('Email verified. Application is now ready for admin review.');
    } catch (e: any) {
      setErr(e?.message || 'Failed to verify email OTP');
    } finally {
      setVerifyingEmailOtp(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f2ea] px-6 py-10 text-[#201a16]">
      <div className="mx-auto max-w-4xl rounded-3xl border border-[#d8c9b7] bg-white p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.32em] text-[#8c6e55]">Sell on Neejee</p>
        <h1 className="mt-3 text-4xl font-semibold">Seller application</h1>
        <p className="mt-3 text-sm text-[#6f5b4a]">
          Phone OTP, email OTP, PAN/GST/CIN/IFSC validation, then admin approval.
        </p>

        {err ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div> : null}
        {msg ? <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{msg}</div> : null}

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <input className="rounded-xl border p-3" placeholder="Business name" value={form.businessName} onChange={(e) => patch('businessName', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Contact name" value={form.contactName} onChange={(e) => patch('contactName', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Email" value={form.email} onChange={(e) => patch('email', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Phone" value={form.phone} onChange={(e) => patch('phone', e.target.value)} />
          <div className="md:col-span-2 flex gap-3">
            <input className="flex-1 rounded-xl border p-3" placeholder="Phone OTP" value={form.phoneOtpCode} onChange={(e) => patch('phoneOtpCode', e.target.value)} />
            <button onClick={requestPhoneOtp} disabled={sendingPhoneOtp} className="rounded-xl bg-black px-5 py-3 text-white">
              {sendingPhoneOtp ? 'Sending…' : 'Send phone OTP'}
            </button>
          </div>

          <input className="rounded-xl border p-3" placeholder="Craft" value={form.craft} onChange={(e) => patch('craft', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Region" value={form.region} onChange={(e) => patch('region', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Cluster" value={form.cluster} onChange={(e) => patch('cluster', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Years of practice" value={form.yearsOfPractice} onChange={(e) => patch('yearsOfPractice', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="PAN" value={form.pan} onChange={(e) => patch('pan', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="GSTIN" value={form.gstin} onChange={(e) => patch('gstin', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="CIN" value={form.cin} onChange={(e) => patch('cin', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Bank account" value={form.bankAccount} onChange={(e) => patch('bankAccount', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="IFSC" value={form.ifsc} onChange={(e) => patch('ifsc', e.target.value)} />
          <input className="rounded-xl border p-3" placeholder="Bank name" value={form.bankName} onChange={(e) => patch('bankName', e.target.value)} />
          <textarea className="md:col-span-2 rounded-xl border p-3" rows={5} placeholder="Story" value={form.story} onChange={(e) => patch('story', e.target.value)} />
        </div>

        <div className="mt-6">
          <button onClick={submitApplication} disabled={loading} className="rounded-xl bg-[#201a16] px-6 py-3 text-white">
            {loading ? 'Submitting…' : 'Submit application'}
          </button>
        </div>

        {result ? (
          <div className="mt-8 rounded-2xl border border-[#d8c9b7] bg-[#fbf8f3] p-6">
            <h2 className="text-xl font-semibold">Auto-validation result</h2>
            <p className="mt-2 text-sm">
              Status after submit: <strong>{result.kycStatus}</strong>
            </p>
            <p className="mt-1 text-sm">
              Auto checks: <strong>{result.autoValidation.ok ? 'Passed' : 'Needs attention'}</strong>
            </p>

            {!result.autoValidation.ok ? (
              <ul className="mt-3 list-disc pl-5 text-sm text-red-700">
                {result.autoValidation.errors.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}

            <div className="mt-6 flex gap-3">
              <input
                className="flex-1 rounded-xl border p-3"
                placeholder="Email OTP"
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
              />
              <button onClick={verifyEmailOtp} disabled={verifyingEmailOtp} className="rounded-xl bg-black px-5 py-3 text-white">
                {verifyingEmailOtp ? 'Verifying…' : 'Verify email OTP'}
              </button>
              <button onClick={resendEmailOtp} disabled={sendingEmailOtp} className="rounded-xl border px-5 py-3">
                {sendingEmailOtp ? 'Sending…' : 'Resend email OTP'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}