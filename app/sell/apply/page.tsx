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

const steps = [
  'Contact',
  'Business',
  'Documents',
  'Validate',
  'Email OTP',
];

const initialForm = {
  businessName: '',
  contactName: '',
  officialEmail: '',
  // email is the communication/login email used by existing seller systems.
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
  accept?: string;
  onUploaded: (doc: UploadedApplicationDocument) => void;
  uploaded?: UploadedApplicationDocument | null;
  uploading: boolean;
  setUploading: (value: boolean) => void;
};

function UploadCard(props: UploadCardProps) {
  async function handleFileChange(file: File | null) {
    if (!file) return;

    props.setUploading(true);
    try {
      const formData = new FormData();
      formData.append('docType', props.docType);
      if (props.title) formData.append('title', props.title);
      formData.append('file', file);

      const res = await fetch('/api/seller/application/upload-document', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'Upload failed');
      }

      props.onUploaded(data.document);
    } catch (e: any) {
      alert(e?.message || 'Upload failed');
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
          <div className="mt-1 text-xs text-stone-500">
            PDF, image, text or CSV
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center rounded-xl bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-black">
          {props.uploading ? 'Uploading...' : props.uploaded ? 'Replace file' : 'Upload file'}
          <input
            type="file"
            className="hidden"
            accept={props.accept || '.pdf,.png,.jpg,.jpeg,.jfif,.webp,.heic,.heif,.csv,.txt,image/*'}
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            disabled={props.uploading}
          />
        </label>
      </div>

      {props.uploaded ? (
        <div className="mt-4 rounded-xl bg-stone-50 p-3">
          <div className="text-xs font-medium text-stone-900">{props.uploaded.fileName}</div>
          <div className="mt-1 text-xs text-stone-500">
            {(props.uploaded.fileSize / 1024).toFixed(1)} KB
          </div>

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
  const [sellerId, setSellerId] = useState<string>('');
  const [emailCode, setEmailCode] = useState('');
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpVerifying, setEmailOtpVerifying] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [notice, setNotice] = useState<string>('');

  function setField<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function upsertDocument(doc: UploadedApplicationDocument) {
    const key = `${doc.docType}::${doc.title || ''}`;
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

  async function requestPhoneOtp() {
    setLoadingPhoneOtp(true);
    setPhoneVerified(false);
    setNotice('');
    try {
      const res = await fetch('/api/seller/application/request-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: form.phone,
          recipientName: form.contactName || 'Seller',
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to send mobile OTP');

      setNotice('Mobile OTP sent successfully. Enter the 6-digit OTP and press Continue.');
    } catch (e: any) {
      alert(e?.message || 'Failed to send mobile OTP');
    } finally {
      setLoadingPhoneOtp(false);
    }
  }

  async function verifyPhoneOtpAndContinue() {
    if (!form.contactName.trim() || !form.officialEmail.trim() || !form.email.trim() || !form.phone.trim()) return;
    if (form.phoneOtp.length !== 6) {
      alert('Please enter the 6-digit mobile OTP.');
      return;
    }

    setVerifyingPhoneOtp(true);
    setNotice('');
    try {
      const res = await fetch('/api/seller/application/verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: form.phone,
          code: form.phoneOtp,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPhoneVerified(false);
        throw new Error(data?.error || 'Mobile OTP verification failed');
      }

      setPhoneVerified(true);
      setNotice('Mobile number verified successfully.');
      setStep(1);
    } catch (e: any) {
      alert(e?.message || 'Mobile OTP verification failed');
    } finally {
      setVerifyingPhoneOtp(false);
    }
  }

  async function validateDocuments() {
    setValidating(true);
    setValidation(null);
    setNotice('');

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
          phone: form.phone || null,
          includeLiveVerification: true,
          documents,
        }),
      });

      const data = await res.json().catch(() => null);
      setValidation(data);

      if (!res.ok) {
        throw new Error(data?.error || 'Validation failed');
      }

      if (data?.overallStatus === 'VERIFIED' && data?.ok) {
        setNotice('Validation passed. Live KYC checks are verified and you can now submit the application.');
      } else if (data?.reviewRequired) {
        setNotice('Validation requires review. Please check mismatches and live KYC findings before submission.');
      } else {
        setNotice('Validation found mismatches. Please review and correct them.');
      }
    } catch (e: any) {
      alert(e?.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  }

  async function submitApplication() {
    setSubmitting(true);
    setNotice('');

    try {
      const res = await fetch('/api/seller/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: form.businessName,
          contactName: form.contactName,
          officialEmail: form.officialEmail,
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
        if (data?.validation) {
          setValidation({
            ok: false,
            ...data.validation,
          });
        }
        throw new Error(data?.error || 'Application submission failed');
      }

      setSellerId(data.sellerId);
      setStep(4);
      setNotice(
        data.emailOtpRequested
          ? `Application submitted. Email OTP has been sent to ${form.email}.`
          : `Application submitted. ${data.emailOtpError || 'Please request email OTP manually.'}`,
      );
    } catch (e: any) {
      alert(e?.message || 'Application submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function requestEmailOtp() {
    if (!sellerId) return;
    setEmailOtpSending(true);
    setNotice('');

    try {
      const res = await fetch('/api/seller/application/request-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to send email OTP');

      setNotice(`Email OTP sent successfully to ${form.email}.`);
    } catch (e: any) {
      alert(e?.message || 'Failed to send email OTP');
    } finally {
      setEmailOtpSending(false);
    }
  }

  async function verifyEmailOtp() {
    if (!sellerId) return;
    setEmailOtpVerifying(true);
    setNotice('');

    try {
      const res = await fetch('/api/seller/application/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId,
          code: emailCode,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || data?.reason || 'Failed to verify email OTP');

      setEmailVerified(true);
      setNotice('Communication email verified. Seller application is now ready for review.');
    } catch (e: any) {
      alert(e?.message || 'Failed to verify email OTP');
    } finally {
      setEmailOtpVerifying(false);
    }
  }

  const canGoBusiness =
    form.contactName.trim() &&
    form.officialEmail.trim() &&
    form.email.trim() &&
    form.phone.trim();

  const canGoDocuments =
    form.businessName.trim() &&
    form.pan.trim() &&
    form.bankAccount.trim() &&
    form.ifsc.trim() &&
    form.bankName.trim();

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
              Seller application
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Complete mobile OTP, upload KYC evidence, validate documents against entered data,
              and submit for Neejee review.
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-5">
            {steps.map((label, idx) => (
              <div
                key={label}
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  idx === step
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : idx < step
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-stone-200 bg-stone-50 text-stone-500'
                }`}
              >
                <div className="text-[11px] uppercase tracking-wide opacity-80">Step {idx + 1}</div>
                <div className="mt-1 font-medium">{label}</div>
              </div>
            ))}
          </div>

          {notice ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {notice}
            </div>
          ) : null}

          <div className="mt-8">
            {step === 0 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Contact details</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    Capture both the business identity email and the address to be used for operational communication.
                  </p>
                  <div className="mt-4 space-y-4">
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Contact name"
                      value={form.contactName}
                      onChange={(e) => setField('contactName', e.target.value)}
                    />
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Official business email"
                      type="email"
                      value={form.officialEmail}
                      onChange={(e) => setField('officialEmail', e.target.value)}
                    />
                    <div>
                      <input
                        className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                        placeholder="Communication email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setField('email', e.target.value)}
                      />
                      <div className="mt-1 text-xs text-stone-500">
                        Email OTP, application acknowledgements and seller communications are sent here. It may be the same as the official email.
                      </div>
                    </div>
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Mobile number"
                      value={form.phone}
                      onChange={(e) => {
                        setField('phone', e.target.value);
                        setPhoneVerified(false);
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Mobile OTP</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    Send the OTP, enter the 6-digit code below, then press Continue. Continue verifies the OTP automatically before moving to Business details.
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={requestPhoneOtp}
                      disabled={loadingPhoneOtp || verifyingPhoneOtp || !canGoBusiness}
                      className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                    >
                      {loadingPhoneOtp ? 'Sending OTP...' : 'Send mobile OTP'}
                    </button>
                  </div>

                  <div className="mt-4">
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Enter 6-digit mobile OTP"
                      value={form.phoneOtp}
                      onChange={(e) => {
                        setField('phoneOtp', e.target.value.replace(/\D+/g, '').slice(0, 6));
                        setPhoneVerified(false);
                      }}
                    />
                  </div>

                  {phoneVerified ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Mobile number verified.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Business identity</h2>
                  <div className="mt-4 space-y-4">
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Business name"
                      value={form.businessName}
                      onChange={(e) => setField('businessName', e.target.value)}
                    />
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase outline-none focus:border-stone-900"
                      placeholder="PAN"
                      value={form.pan}
                      onChange={(e) => setField('pan', e.target.value.toUpperCase())}
                    />
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase outline-none focus:border-stone-900"
                      placeholder="GSTIN (optional)"
                      value={form.gstin}
                      onChange={(e) => setField('gstin', e.target.value.toUpperCase())}
                    />
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase outline-none focus:border-stone-900"
                      placeholder="MSME / Udyam number (optional)"
                      value={form.msmeNumber}
                      onChange={(e) => setField('msmeNumber', e.target.value.toUpperCase())}
                    />
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase outline-none focus:border-stone-900"
                      placeholder="CIN (optional)"
                      value={form.cin}
                      onChange={(e) => setField('cin', e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Bank details</h2>
                  <div className="mt-4 space-y-4">
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Bank account number"
                      value={form.bankAccount}
                      onChange={(e) => setField('bankAccount', e.target.value.replace(/\s+/g, ''))}
                    />
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm uppercase outline-none focus:border-stone-900"
                      placeholder="IFSC"
                      value={form.ifsc}
                      onChange={(e) => setField('ifsc', e.target.value.toUpperCase())}
                    />
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Bank name"
                      value={form.bankName}
                      onChange={(e) => setField('bankName', e.target.value)}
                    />

                    <div className="pt-2">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-stone-500">Business address</p>
                    </div>

                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Address line 1"
                      value={form.addressLine1}
                      onChange={(e) => setField('addressLine1', e.target.value)}
                    />
                    <input
                      className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                      placeholder="Address line 2 (optional)"
                      value={form.addressLine2}
                      onChange={(e) => setField('addressLine2', e.target.value)}
                    />

                    <div className="grid gap-4 sm:grid-cols-3">
                      <input
                        className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                        placeholder="City"
                        value={form.city}
                        onChange={(e) => setField('city', e.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                        placeholder="State"
                        value={form.state}
                        onChange={(e) => setField('state', e.target.value)}
                      />
                      <input
                        className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                        placeholder="Pincode"
                        value={form.pincode}
                        onChange={(e) => setField('pincode', e.target.value.replace(/\D+/g, '').slice(0, 6))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <UploadCard
                  label="PAN card"
                  docType="PAN_CARD"
                  required
                  uploaded={getDocument('PAN_CARD')}
                  uploading={uploadingKey === 'PAN_CARD'}
                  setUploading={(value) => setUploadingKey(value ? 'PAN_CARD' : null)}
                  onUploaded={upsertDocument}
                />

                <UploadCard
                  label="GST certificate"
                  docType="GST_CERTIFICATE"
                  required={!!form.gstin}
                  uploaded={getDocument('GST_CERTIFICATE')}
                  uploading={uploadingKey === 'GST_CERTIFICATE'}
                  setUploading={(value) => setUploadingKey(value ? 'GST_CERTIFICATE' : null)}
                  onUploaded={upsertDocument}
                />

                <UploadCard
                  label="MSME / Udyam certificate"
                  docType="MSME_CERTIFICATE"
                  required={!!form.msmeNumber}
                  uploaded={getDocument('MSME_CERTIFICATE')}
                  uploading={uploadingKey === 'MSME_CERTIFICATE'}
                  setUploading={(value) => setUploadingKey(value ? 'MSME_CERTIFICATE' : null)}
                  onUploaded={upsertDocument}
                />

                <UploadCard
                  label="CIN certificate / incorporation proof"
                  docType="CERTIFICATION"
                  title="CIN Certificate"
                  required={!!form.cin}
                  uploaded={getDocument('CERTIFICATION', 'CIN Certificate')}
                  uploading={uploadingKey === 'CIN_CERT'}
                  setUploading={(value) => setUploadingKey(value ? 'CIN_CERT' : null)}
                  onUploaded={upsertDocument}
                />

                <UploadCard
                  label="Cancelled cheque"
                  docType="CANCELLED_CHEQUE"
                  required
                  uploaded={getDocument('CANCELLED_CHEQUE')}
                  uploading={uploadingKey === 'CANCELLED_CHEQUE'}
                  setUploading={(value) => setUploadingKey(value ? 'CANCELLED_CHEQUE' : null)}
                  onUploaded={upsertDocument}
                />

                <UploadCard
                  label="Bank statement / screenshot / CSV"
                  docType="BANK_STATEMENT"
                  required
                  uploaded={getDocument('BANK_STATEMENT')}
                  uploading={uploadingKey === 'BANK_STATEMENT'}
                  setUploading={(value) => setUploadingKey(value ? 'BANK_STATEMENT' : null)}
                  onUploaded={upsertDocument}
                />

                <UploadCard
                  label="Additional supporting document"
                  docType="OTHER"
                  title="Additional Supporting Document"
                  required={false}
                  uploaded={getDocument('OTHER', 'Additional Supporting Document')}
                  uploading={uploadingKey === 'OTHER'}
                  setUploading={(value) => setUploadingKey(value ? 'OTHER' : null)}
                  onUploaded={upsertDocument}
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Validation review</h2>
                  <p className="mt-2 text-sm text-stone-600">
                    This step checks manual entries against uploaded evidence and configured provider hooks.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={validateDocuments}
                      disabled={validating || !requiredDocsReady}
                      className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                    >
                      {validating ? 'Validating...' : 'Run KYC validation'}
                    </button>

                    <button
                      type="button"
                      onClick={submitApplication}
                      disabled={submitting || !validation?.ok || !phoneVerified}
                      className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {submitting ? 'Submitting...' : 'Submit application'}
                    </button>
                  </div>

                  {!requiredDocsReady ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                      Required uploads are not complete yet.
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-stone-200 p-5">
                  <h2 className="text-lg font-semibold text-stone-900">Result</h2>

                  {validation ? (
                    <div className="mt-4 space-y-4">
                      <div className={`rounded-xl px-4 py-3 text-sm ${
                        validation.overallStatus === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-800'
                          : validation.reviewRequired
                            ? 'bg-amber-50 text-amber-800'
                            : validation.ok
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-red-50 text-red-800'
                      }`}>
                        {validation.overallStatus === 'VERIFIED'
                          ? 'Validation verified'
                          : validation.reviewRequired
                            ? 'Validation requires review'
                            : validation.ok
                              ? 'Validation passed'
                              : 'Validation failed'}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
                          <div className="font-medium text-stone-900">Overall status</div>
                          <div className="mt-1 text-stone-600">{validation.overallStatus || (validation.ok ? 'VERIFIED' : 'FAILED')}</div>
                        </div>
                        <div className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
                          <div className="font-medium text-stone-900">Review required</div>
                          <div className="mt-1 text-stone-600">{validation.reviewRequired ? 'Yes' : 'No'}</div>
                        </div>
                        <div className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
                          <div className="font-medium text-stone-900">Live verification</div>
                          <div className="mt-1 text-stone-600">{validation.includeLiveVerification ? 'Enabled' : 'Not requested'}</div>
                        </div>
                        <div className="rounded-xl border border-stone-200 px-4 py-3 text-sm">
                          <div className="font-medium text-stone-900">KYC package status</div>
                          <div className="mt-1 text-stone-600">{validation.kycPackageVerification?.overallStatus || 'Not available'}</div>
                        </div>
                      </div>

                      {validation.kycPackageVerification?.summary ? (
                        <div className="rounded-xl border border-stone-200 p-4">
                          <div className="text-sm font-medium text-stone-900">Live KYC summary</div>
                          <div className="mt-2 grid gap-3 sm:grid-cols-4 text-sm text-stone-600">
                            <div>Total checks: {validation.kycPackageVerification.summary.totalChecks ?? 0}</div>
                            <div>Passed: {validation.kycPackageVerification.summary.okCount ?? 0}</div>
                            <div>Failed: {validation.kycPackageVerification.summary.failedCount ?? 0}</div>
                            <div>Review required: {validation.kycPackageVerification.summary.reviewRequiredCount ?? 0}</div>
                          </div>

                          {validation.kycPackageVerification.summary.statuses?.length ? (
                            <ul className="mt-3 space-y-2 text-sm text-stone-700">
                              {validation.kycPackageVerification.summary.statuses.map((item) => (
                                <li key={`${item.kind}-${item.provider}`} className="rounded-lg bg-stone-50 px-3 py-2">
                                  <span className="font-medium uppercase">{item.kind}</span>: {item.status} via {item.provider} · {item.reviewRequired ? 'review required' : 'clear'}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}

                      {validation.errors?.length ? (
                        <div>
                          <div className="text-sm font-medium text-stone-900">Errors</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                            {validation.errors.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {validation.warnings?.length ? (
                        <div>
                          <div className="text-sm font-medium text-stone-900">Warnings</div>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-700">
                            {validation.warnings.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {validation.kycPackageVerification?.error ? (
                        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
                          Live KYC package error: {validation.kycPackageVerification.error}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-stone-500">
                      No validation run yet.
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="max-w-2xl rounded-2xl border border-stone-200 p-5">
                <h2 className="text-lg font-semibold text-stone-900">Email OTP verification</h2>
                <p className="mt-2 text-sm text-stone-600">
                  Your application has been created. The verification code and future seller communications are sent to the communication email: <span className="font-medium text-stone-900">{form.email}</span>.
                </p>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={requestEmailOtp}
                    disabled={!sellerId || emailOtpSending}
                    className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
                  >
                    {emailOtpSending ? 'Sending email OTP...' : 'Send / resend email OTP'}
                  </button>
                </div>

                <div className="mt-4">
                  <input
                    className="w-full rounded-xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-900"
                    placeholder="Enter 6-digit email OTP"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
                  />
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={verifyEmailOtp}
                    disabled={!sellerId || emailCode.length !== 6 || emailOtpVerifying || emailVerified}
                    className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {emailOtpVerifying ? 'Verifying...' : emailVerified ? 'Email verified' : 'Verify email OTP'}
                  </button>
                </div>

                {emailVerified ? (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Communication email verification complete. The seller application is ready for Neejee review.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(prev - 1, 0))}
              disabled={step === 0}
              className="rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => {
                if (step === 0) {
                  void verifyPhoneOtpAndContinue();
                  return;
                }
                if (step === 1 && canGoDocuments) setStep(2);
                else if (step === 2) setStep(3);
                else if (step === 3 && sellerId) setStep(4);
              }}
              disabled={
                (step === 0 && (!canGoBusiness || form.phoneOtp.length !== 6 || verifyingPhoneOtp || loadingPhoneOtp)) ||
                (step === 1 && !canGoDocuments) ||
                step === 4
              }
              className="rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {step === 0 && verifyingPhoneOtp ? 'Verifying OTP...' : step === 4 ? 'Done' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
