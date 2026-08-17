'use client';

import { useMemo, useState } from 'react';

type ApplicationDocType =
  | 'PAN_CARD'
  | 'GST_CERTIFICATE'
  | 'MSME_CERTIFICATE'
  | 'CANCELLED_CHEQUE'
  | 'BANK_STATEMENT'
  | 'CERTIFICATION'
  | 'OTHER';

type UploadedApplicationDocument = {
  docType: ApplicationDocType;
  title: string | null;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  uploadProof: string;
  extractionWarning?: string | null;
  extractedTextPreview: string;
  extractedFields: {
    pans: string[];
    gstins: string[];
    cins: string[];
    ifscs: string[];
    bankAccounts: string[];
    msmeNumbers: string[];
  };
};

type ValidationStatusItem = {
  kind: string;
  status: string;
  provider: string;
  ok: boolean;
  reviewRequired: boolean;
};

type ValidationResult = {
  ok: boolean;
  overallPass?: boolean;
  overallStatus?: string;
  reviewRequired?: boolean;
  errors?: string[];
  warnings?: string[];
  provider?: Record<string, any>;
  extracted?: Record<string, any>;
  documentsPresent?: Record<string, boolean>;
  includeLiveVerification?: boolean;
  kycPackageHttpStatus?: number | null;
  kycPackageVerification?: {
    ok?: boolean;
    overallStatus?: string;
    reviewRequired?: boolean;
    submitted?: Record<string, any>;
    verifications?: Record<string, any>;
    summary?: {
      totalChecks?: number;
      okCount?: number;
      failedCount?: number;
      reviewRequiredCount?: number;
      statuses?: ValidationStatusItem[];
    };
    error?: string;
  } | null;
};

const steps = ['Contact', 'Business', 'Documents', 'Validate', 'Email OTP'];

const initialForm = {
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  phoneOtp: '',
  pan: '',
  gstin: '',
  msmeNumber: '',
  cin: '',
  bankAccount: '',
  ifsc: '',
  bankName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
};

type UploadCardProps = {
  label: string;
  docType: ApplicationDocType;
  title?: string | null;
  required?: boolean;
  uploaded?: UploadedApplicationDocument | null;
  uploading: boolean;
  setUploading: (value: boolean) => void;
  onUploaded: (doc: UploadedApplicationDocument) => void;
  onError: (message: string) => void;
};

function UploadCard(props: UploadCardProps) {
  const [localError, setLocalError] = useState('');

  async function removePrevious(previous?: UploadedApplicationDocument | null) {
    if (!previous?.uploadProof) return;
    await fetch('/api/seller/application/upload-document', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadProof: previous.uploadProof }),
    }).catch(() => null);
  }

  async function handleFileChange(file: File | null) {
    if (!file) return;
    setLocalError('');
    props.setUploading(true);

    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('File must be 8 MB or smaller.');

      const formData = new FormData();
      formData.append('docType', props.docType);
      if (props.title) formData.append('title', props.title);
      formData.append('file', file);

      const res = await fetch('/api/seller/application/upload-document', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      if (!data?.document?.uploadProof) throw new Error('Secure upload confirmation was not received. Please retry.');

      const previous = props.uploaded;
      props.onUploaded(data.document);
      await removePrevious(previous);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setLocalError(message);
      props.onError(message);
    } finally {
      props.setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-stone-900">
            {props.label} {props.required ? <span className="text-red-600">*</span> : null}
          </div>
          <div className="mt-1 text-xs text-stone-500">PDF, JPG, PNG, WebP, CSV or TXT · max 8 MB</div>
        </div>
        <label className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-medium text-white ${props.uploading ? 'cursor-wait bg-stone-400' : 'cursor-pointer bg-stone-900 hover:bg-black'}`}>
          {props.uploading ? 'Securing...' : props.uploaded ? 'Replace file' : 'Upload file'}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
            onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
            disabled={props.uploading}
          />
        </label>
      </div>

      {localError ? (
        <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {localError}
        </div>
      ) : null}

      {props.uploaded ? (
        <div className="mt-4 rounded-xl bg-stone-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-stone-900">{props.uploaded.fileName}</div>
              <div className="mt-1 text-xs text-stone-500">{(props.uploaded.fileSize / 1024).toFixed(1)} KB · stored privately</div>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-800">Secure</span>
          </div>

          {props.uploaded.extractionWarning ? (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">{props.uploaded.extractionWarning}</div>
          ) : null}

          <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-stone-700 md:grid-cols-2">
            {props.uploaded.extractedFields.pans.length ? <div>PAN: {props.uploaded.extractedFields.pans.join(', ')}</div> : null}
            {props.uploaded.extractedFields.gstins.length ? <div>GSTIN: {props.uploaded.extractedFields.gstins.join(', ')}</div> : null}
            {props.uploaded.extractedFields.cins.length ? <div>CIN: {props.uploaded.extractedFields.cins.join(', ')}</div> : null}
            {props.uploaded.extractedFields.ifscs.length ? <div>IFSC: {props.uploaded.extractedFields.ifscs.join(', ')}</div> : null}
            {props.uploaded.extractedFields.bankAccounts.length ? <div>A/C: {props.uploaded.extractedFields.bankAccounts.join(', ')}</div> : null}
            {props.uploaded.extractedFields.msmeNumbers.length ? <div>MSME: {props.uploaded.extractedFields.msmeNumbers.join(', ')}</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function SellerApplyPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [documents, setDocuments] = useState<UploadedApplicationDocument[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loadingPhoneOtp, setLoadingPhoneOtp] = useState(false);
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [sellerId, setSellerId] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  function setField<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    if (key === 'phone' && value !== form.phone) {
      setPhoneVerified(false);
      setValidation(null);
      setSellerId('');
      setEmailVerified(false);
      setDocuments([]);
      setForm((prev) => ({ ...prev, phone: String(value), phoneOtp: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
    if (['pan', 'gstin', 'msmeNumber', 'cin', 'bankAccount', 'ifsc', 'businessName'].includes(key)) {
      setValidation(null);
    }
  }

  function upsertDocument(doc: UploadedApplicationDocument) {
    const key = `${doc.docType}::${doc.title || ''}`;
    setValidation(null);
    setDocuments((prev) => {
      const next = [...prev];
      const idx = next.findIndex((item) => `${item.docType}::${item.title || ''}` === key);
      if (idx >= 0) next[idx] = doc;
      else next.push(doc);
      return next;
    });
  }

  function getDocument(docType: ApplicationDocType, title?: string | null) {
    return documents.find((doc) => doc.docType === docType && (doc.title || '') === (title || '')) || null;
  }

  const requiredDocsReady = useMemo(() => {
    const hasPan = !!getDocument('PAN_CARD');
    const hasCheque = !!getDocument('CANCELLED_CHEQUE');
    const hasBank = !!getDocument('BANK_STATEMENT');
    const hasGst = form.gstin ? !!getDocument('GST_CERTIFICATE') : true;
    const hasMsme = form.msmeNumber ? !!getDocument('MSME_CERTIFICATE') : true;
    const hasCin = form.cin ? !!getDocument('CERTIFICATION', 'CIN Certificate') : true;
    return hasPan && hasCheque && hasBank && hasGst && hasMsme && hasCin;
  }, [documents, form.gstin, form.msmeNumber, form.cin]);

  const canGoBusiness = Boolean(form.contactName.trim() && form.email.trim() && form.phone.trim() && phoneVerified);
  const canGoDocuments = Boolean(
    form.businessName.trim()
      && form.pan.trim().length === 10
      && form.bankAccount.trim()
      && form.ifsc.trim()
      && form.bankName.trim()
      && form.addressLine1.trim()
      && form.city.trim()
      && form.state.trim()
      && /^\d{6}$/.test(form.pincode),
  );

  async function requestPhoneOtp() {
    setLoadingPhoneOtp(true);
    setNotice('');
    setError('');
    setPhoneVerified(false);
    try {
      const res = await fetch('/api/seller/application/request-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, recipientName: form.contactName || 'Seller' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to send mobile OTP');
      setNotice('Mobile OTP sent. Enter the code below and verify it before continuing.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send mobile OTP');
    } finally {
      setLoadingPhoneOtp(false);
    }
  }

  async function verifyPhoneOtp() {
    setVerifyingPhoneOtp(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/seller/application/verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone, code: form.phoneOtp }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Mobile OTP verification failed');
      setPhoneVerified(true);
      setNotice('Mobile number verified. You can continue with the seller application.');
    } catch (err) {
      setPhoneVerified(false);
      setError(err instanceof Error ? err.message : 'Mobile OTP verification failed');
    } finally {
      setVerifyingPhoneOtp(false);
    }
  }

  async function validateDocuments() {
    setValidating(true);
    setValidation(null);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/seller/application/validate-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          pan: form.pan,
          gstin: form.gstin || null,
          cin: form.cin || null,
          msmeNumber: form.msmeNumber || null,
          bankAccount: form.bankAccount,
          ifsc: form.ifsc,
          phone: form.phone,
          includeLiveVerification: true,
          documents,
        }),
      });
      const data = await res.json().catch(() => null);
      setValidation(data);
      if (!res.ok) throw new Error(data?.error || 'Validation failed');

      if (data?.overallStatus === 'VERIFIED' && data?.ok) {
        setNotice('Validation passed. You can submit the application.');
      } else if (data?.reviewRequired && data?.ok) {
        setNotice('Document matching passed. Some checks will require NEEJEE review after submission.');
      } else {
        setNotice('Validation found mismatches. Please review the findings before submission.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  }

  async function submitApplication() {
    setSubmitting(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/seller/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          pan: form.pan,
          gstin: form.gstin || null,
          cin: form.cin || null,
          msmeNumber: form.msmeNumber || null,
          bankAccount: form.bankAccount,
          ifsc: form.ifsc,
          bankName: form.bankName,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2 || null,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          documents,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.validation) setValidation({ ok: false, ...data.validation });
        throw new Error(data?.error || 'Application submission failed');
      }
      setSellerId(data.sellerId);
      setStep(4);
      setNotice(
        data.emailOtpRequested
          ? 'Application submitted securely. A verification code has been sent to your email.'
          : `Application submitted securely. ${data.emailOtpError || 'Please request the email code below.'}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestEmailOtp() {
    if (!sellerId) return;
    setEmailOtpSending(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/seller/application/request-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to send email OTP');
      setNotice('Email verification code sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email OTP');
    } finally {
      setEmailOtpSending(false);
    }
  }

  async function verifyEmailOtp() {
    if (!sellerId) return;
    setEmailOtpVerifying(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/seller/application/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId, code: emailCode }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.reason || 'Failed to verify email OTP');
      setEmailVerified(true);
      setNotice('Email verified. Your application and KYC dossier are ready for NEEJEE review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify email OTP');
    } finally {
      setEmailOtpVerifying(false);
    }
  }

  const uploadProps = (key: string) => ({
    uploading: uploadingKey === key,
    setUploading: (value: boolean) => setUploadingKey(value ? key : null),
    onUploaded: upsertDocument,
    onError: (message: string) => setError(message),
  });

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Seller application</h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Verify your mobile number, submit business details and private KYC evidence, run document checks, then verify email ownership for NEEJEE review.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-5">
            {steps.map((label, idx) => (
              <div key={label} className={`rounded-2xl border px-4 py-3 text-sm ${idx === step ? 'border-stone-900 bg-stone-900 text-white' : idx < step ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-stone-200 bg-stone-50 text-stone-500'}`}>
                <div className="text-[11px] uppercase tracking-wide opacity-80">Step {idx + 1}</div>
                <div className="mt-1 font-medium">{label}</div>
              </div>
            ))}
          </div>

          {notice ? <div role="status" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</div> : null}
          {error ? <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

          <div className="mt-8">
            {step === 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Contact details</h2>
                  <div className="mt-4 space-y-4">
                    <input aria-label="Contact name" autoComplete="name" className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900" placeholder="Contact name" value={form.contactName} onChange={(e) => setField('contactName', e.target.value)} />
                    <input aria-label="Email" autoComplete="email" className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900" placeholder="Email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
                    <input aria-label="Mobile number" autoComplete="tel" className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900" placeholder="Mobile number" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Mobile verification</h2>
                  <p className="mt-2 text-sm text-stone-600">Sensitive KYC uploads stay locked until this mobile number is verified.</p>
                  <button type="button" onClick={() => void requestPhoneOtp()} disabled={loadingPhoneOtp || !form.phone.trim() || !form.contactName.trim()} className="mt-4 rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300">
                    {loadingPhoneOtp ? 'Sending OTP...' : 'Send mobile OTP'}
                  </button>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input aria-label="Mobile OTP" inputMode="numeric" autoComplete="one-time-code" className="min-w-0 flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900" placeholder="Enter mobile OTP" value={form.phoneOtp} onChange={(e) => setField('phoneOtp', e.target.value.replace(/\D+/g, '').slice(0, 8))} disabled={phoneVerified} />
                    <button type="button" onClick={() => void verifyPhoneOtp()} disabled={verifyingPhoneOtp || phoneVerified || form.phoneOtp.length < 4} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300">
                      {verifyingPhoneOtp ? 'Verifying...' : phoneVerified ? 'Mobile verified' : 'Verify OTP'}
                    </button>
                  </div>
                  {phoneVerified ? <div className="mt-3 text-sm font-medium text-emerald-700">✓ Mobile ownership verified</div> : null}
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Business identity</h2>
                  <div className="mt-4 space-y-4">
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="Business name" value={form.businessName} onChange={(e) => setField('businessName', e.target.value)} />
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase" placeholder="PAN" maxLength={10} value={form.pan} onChange={(e) => setField('pan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase" placeholder="GSTIN (optional)" value={form.gstin} onChange={(e) => setField('gstin', e.target.value.toUpperCase())} />
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase" placeholder="MSME / Udyam number (optional)" value={form.msmeNumber} onChange={(e) => setField('msmeNumber', e.target.value.toUpperCase())} />
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase" placeholder="CIN (optional)" value={form.cin} onChange={(e) => setField('cin', e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Bank & business address</h2>
                  <div className="mt-4 space-y-4">
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="Bank account number" value={form.bankAccount} onChange={(e) => setField('bankAccount', e.target.value.replace(/\s+/g, ''))} />
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase" placeholder="IFSC" value={form.ifsc} onChange={(e) => setField('ifsc', e.target.value.toUpperCase())} />
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="Bank name" value={form.bankName} onChange={(e) => setField('bankName', e.target.value)} />
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="Address line 1" value={form.addressLine1} onChange={(e) => setField('addressLine1', e.target.value)} />
                    <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="Address line 2 (optional)" value={form.addressLine2} onChange={(e) => setField('addressLine2', e.target.value)} />
                    <div className="grid gap-4 sm:grid-cols-3">
                      <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="City" value={form.city} onChange={(e) => setField('city', e.target.value)} />
                      <input className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="State" value={form.state} onChange={(e) => setField('state', e.target.value)} />
                      <input inputMode="numeric" className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="Pincode" value={form.pincode} onChange={(e) => setField('pincode', e.target.value.replace(/\D+/g, '').slice(0, 6))} />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div>
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Your documents are stored in NEEJEE private storage and are not exposed as public web files.</div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <UploadCard label="PAN card" docType="PAN_CARD" required uploaded={getDocument('PAN_CARD')} {...uploadProps('PAN_CARD')} />
                  <UploadCard label="GST certificate" docType="GST_CERTIFICATE" required={!!form.gstin} uploaded={getDocument('GST_CERTIFICATE')} {...uploadProps('GST_CERTIFICATE')} />
                  <UploadCard label="MSME / Udyam certificate" docType="MSME_CERTIFICATE" required={!!form.msmeNumber} uploaded={getDocument('MSME_CERTIFICATE')} {...uploadProps('MSME_CERTIFICATE')} />
                  <UploadCard label="CIN certificate / incorporation proof" docType="CERTIFICATION" title="CIN Certificate" required={!!form.cin} uploaded={getDocument('CERTIFICATION', 'CIN Certificate')} {...uploadProps('CIN_CERT')} />
                  <UploadCard label="Cancelled cheque" docType="CANCELLED_CHEQUE" required uploaded={getDocument('CANCELLED_CHEQUE')} {...uploadProps('CANCELLED_CHEQUE')} />
                  <UploadCard label="Bank statement / screenshot / CSV" docType="BANK_STATEMENT" required uploaded={getDocument('BANK_STATEMENT')} {...uploadProps('BANK_STATEMENT')} />
                  <UploadCard label="Additional supporting document" docType="OTHER" title="Additional Supporting Document" uploaded={getDocument('OTHER', 'Additional Supporting Document')} {...uploadProps('OTHER')} />
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Validation review</h2>
                  <p className="mt-2 text-sm text-stone-600">Server-verified document evidence is matched against the details you entered. Unreadable OCR is routed for manual review rather than treated as a false mismatch.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={() => void validateDocuments()} disabled={validating || !requiredDocsReady} className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:bg-stone-300">{validating ? 'Validating...' : 'Run KYC validation'}</button>
                    <button type="button" onClick={() => void submitApplication()} disabled={submitting || !validation?.ok || !phoneVerified} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:bg-emerald-300">{submitting ? 'Submitting...' : 'Submit application'}</button>
                  </div>
                  {!requiredDocsReady ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Required uploads are not complete yet.</div> : null}
                </div>

                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Result</h2>
                  {validation ? (
                    <div className="mt-4 space-y-4">
                      <div className={`rounded-xl px-4 py-3 text-sm ${validation.ok ? (validation.reviewRequired ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800') : 'bg-red-50 text-red-800'}`}>
                        {validation.ok ? (validation.reviewRequired ? 'Document match passed · review required' : 'Validation verified') : 'Validation failed'}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 text-sm">
                        <div className="rounded-xl border border-stone-200 px-4 py-3"><div className="font-medium">Overall status</div><div className="mt-1 text-stone-600">{validation.overallStatus || (validation.ok ? 'VERIFIED' : 'FAILED')}</div></div>
                        <div className="rounded-xl border border-stone-200 px-4 py-3"><div className="font-medium">Review required</div><div className="mt-1 text-stone-600">{validation.reviewRequired ? 'Yes' : 'No'}</div></div>
                      </div>
                      {validation.errors?.length ? <div><div className="text-sm font-medium">Errors</div><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">{validation.errors.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                      {validation.warnings?.length ? <div><div className="text-sm font-medium">Review notes</div><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">{validation.warnings.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
                      {validation.kycPackageVerification?.summary ? (
                        <div className="rounded-xl border border-stone-200 p-4 text-sm text-stone-600">
                          <div className="font-medium text-stone-900">Live KYC summary</div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <div>Checks: {validation.kycPackageVerification.summary.totalChecks ?? 0}</div>
                            <div>Passed: {validation.kycPackageVerification.summary.okCount ?? 0}</div>
                            <div>Failed: {validation.kycPackageVerification.summary.failedCount ?? 0}</div>
                            <div>Review: {validation.kycPackageVerification.summary.reviewRequiredCount ?? 0}</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : <div className="mt-4 text-sm text-stone-500">No validation run yet.</div>}
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="max-w-2xl rounded-2xl border border-stone-200 p-5">
                <h2 className="text-lg font-semibold text-stone-900">Email ownership verification</h2>
                <p className="mt-2 text-sm text-stone-600">Your application has been stored securely. Verify the email address before the KYC dossier enters the NEEJEE review queue.</p>
                <button type="button" onClick={() => void requestEmailOtp()} disabled={!sellerId || emailOtpSending} className="mt-4 rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:bg-stone-300">{emailOtpSending ? 'Sending email OTP...' : 'Send / resend email OTP'}</button>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input aria-label="Email verification code" inputMode="numeric" autoComplete="one-time-code" className="min-w-0 flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm" placeholder="Enter 6-digit email OTP" value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D+/g, '').slice(0, 6))} />
                  <button type="button" onClick={() => void verifyEmailOtp()} disabled={!sellerId || emailCode.length !== 6 || emailOtpVerifying || emailVerified} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:bg-emerald-300">{emailOtpVerifying ? 'Verifying...' : emailVerified ? 'Email verified' : 'Verify email OTP'}</button>
                </div>
                {emailVerified ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Verification complete. Your seller application is ready for NEEJEE review. Approval remains an admin decision.</div> : null}
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep((prev) => Math.max(prev - 1, 0))} disabled={step === 0 || step === 4} className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 disabled:cursor-not-allowed disabled:opacity-40">Back</button>
            <button
              type="button"
              onClick={() => {
                setError('');
                if (step === 0 && canGoBusiness) setStep(1);
                else if (step === 1 && canGoDocuments) setStep(2);
                else if (step === 2 && requiredDocsReady && !uploadingKey) setStep(3);
              }}
              disabled={(step === 0 && !canGoBusiness) || (step === 1 && !canGoDocuments) || (step === 2 && (!requiredDocsReady || !!uploadingKey)) || step >= 3}
              className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {step >= 3 ? (step === 4 ? 'Done' : 'Validate above') : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
