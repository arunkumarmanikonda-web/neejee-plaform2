'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ApiField = {
  key: string;
  value: string;
  configured: boolean;
  secret: boolean;
};

type ApiData = {
  canEdit: boolean;
  vercel: {
    configured: boolean;
    projectId: string | null;
    teamId: string | null;
  };
  runtimeStatus: Record<string, boolean>;
  fields: ApiField[];
};

const SECTIONS: Array<{
  id: string;
  title: string;
  helper: string;
  keys: string[];
}> = [
  {
    id: 'core',
    title: 'Core platform',
    helper: 'Base URL and storage configuration used across storefront and uploads.',
    keys: ['NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'],
  },
  {
    id: 'payments',
    title: 'Payments',
    helper: 'Razorpay credentials.',
    keys: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
  },
  {
    id: 'shipping',
    title: 'Shipping and messaging',
    helper: 'Shiprocket and WhatsApp/email providers.',
    keys: ['SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD', 'WATI_API_KEY', 'RESEND_API_KEY'],
  },
  {
    id: 'ai',
    title: 'AI services',
    helper: 'Models and legacy image pipelines.',
    keys: ['OPENAI_API_KEY', 'FAL_KEY', 'REPLICATE_API_TOKEN'],
  },
  {
    id: 'sms',
    title: 'SMS / OTP',
    helper: 'Fast2SMS provider settings used by the SMS admin screen.',
    keys: ['FAST2SMS_API_KEY', 'FAST2SMS_SENDER_ID', 'FAST2SMS_ENTITY_ID', 'FAST2SMS_ROUTE', 'FAST2SMS_TEST_PHONE'],
  },
];

const LABELS: Record<string, string> = {
  NEXT_PUBLIC_BASE_URL: 'Public base URL',
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase URL',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase service role key',
  SUPABASE_STORAGE_BUCKET: 'Supabase storage bucket',
  RAZORPAY_KEY_ID: 'Razorpay key ID',
  RAZORPAY_KEY_SECRET: 'Razorpay key secret',
  SHIPROCKET_EMAIL: 'Shiprocket email',
  SHIPROCKET_PASSWORD: 'Shiprocket password',
  WATI_API_KEY: 'WATI API key',
  RESEND_API_KEY: 'Resend API key',
  OPENAI_API_KEY: 'OpenAI API key',
  FAL_KEY: 'FAL key',
  REPLICATE_API_TOKEN: 'Replicate token',
  FAST2SMS_API_KEY: 'Fast2SMS API key',
  FAST2SMS_SENDER_ID: 'Fast2SMS sender ID',
  FAST2SMS_ENTITY_ID: 'Fast2SMS entity ID',
  FAST2SMS_ROUTE: 'Fast2SMS route',
  FAST2SMS_TEST_PHONE: 'Default SMS test phone',
};

const RUNTIME_LABELS: Array<{ key: string; label: string }> = [
  { key: 'database', label: 'Database' },
  { key: 'directUrl', label: 'Direct URL' },
  { key: 'authSecret', label: 'Auth secret' },
  { key: 'baseUrl', label: 'Base URL' },
  { key: 'storage', label: 'Storage' },
  { key: 'supabaseUrl', label: 'Supabase URL' },
  { key: 'supabaseServiceKey', label: 'Supabase service key' },
  { key: 'shiprocket', label: 'Shiprocket' },
  { key: 'razorpay', label: 'Razorpay' },
  { key: 'resend', label: 'Resend' },
  { key: 'wati', label: 'WATI' },
  { key: 'openai', label: 'OpenAI' },
  { key: 'fal', label: 'FAL' },
  { key: 'replicate', label: 'Replicate' },
  { key: 'sms', label: 'SMS provider' },
];

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState<ApiData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error || `Failed to load settings (${res.status})`);

      const nextForm = Object.fromEntries((json.fields || []).map((f: ApiField) => [f.key, f.value || '']));
      setData(json);
      setForm(nextForm);
      setOriginal(nextForm);
    } catch (e: any) {
      setError(e?.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const fieldMap = useMemo(() => {
    const map = new Map<string, ApiField>();
    for (const field of data?.fields || []) map.set(field.key, field);
    return map;
  }, [data]);

  async function saveKeys(keys: string[]) {
    if (!data?.canEdit || keys.length === 0) return;
    const payload = Object.fromEntries(keys.map((key) => [key, form[key] || '']));
    setSavingKey(keys.length === 1 ? keys[0] : '__bulk__');
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: payload }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      setOriginal((prev) => ({ ...prev, ...payload }));
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          fields: prev.fields.map((field) =>
            Object.prototype.hasOwnProperty.call(payload, field.key)
              ? {
                  ...field,
                  value: payload[field.key] || '',
                  configured: !!(payload[field.key] || '').trim(),
                }
              : field
          ),
        };
      });
      setNotice(json?.note || 'Saved to Vercel.');
    } catch (e: any) {
      setError(e?.message || 'Save failed.');
    } finally {
      setSavingKey(null);
    }
  }


  if (loading) {
    return <div className="p-8 font-ui text-sm text-kohl/70">Loading settingsâ€¦</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <p className="label text-madder">CONFIG</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Settings</h1>
      <p className="font-italic italic text-mitti mt-2">
        Environment sync, provider credentials, and runtime health.
      </p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-8">
        <Link href="/admin/legal-entity" className="bg-beige p-5 hover:bg-madder/10 border border-mitti/15 hover:border-madder transition-colors">
          <p className="label text-madder">LEGAL ENTITY</p>
          <p className="font-display text-kohl mt-1">Edit store identity</p>
          <p className="text-xs text-mitti mt-1 italic">Invoices, GST, bank, public contact</p>
        </Link>
        <Link href="/admin/settings/shipping" className="bg-beige p-5 hover:bg-madder/10 border border-mitti/15 hover:border-madder transition-colors">
          <p className="label text-madder">SHIPPING</p>
          <p className="font-display text-kohl mt-1">Rates and zones</p>
          <p className="text-xs text-mitti mt-1 italic">Per-state and pincode rules</p>
        </Link>
        <Link href="/admin/settings/sms" className="bg-beige p-5 hover:bg-madder/10 border border-mitti/15 hover:border-madder transition-colors">
          <p className="label text-madder">SMS</p>
          <p className="font-display text-kohl mt-1">Templates and health</p>
          <p className="text-xs text-mitti mt-1 italic">OTP and delivery logs</p>
        </Link>
        <div className="bg-beige p-5 border border-mitti/15">
          <p className="label text-madder">VERCEL SYNC</p>
          <p className="font-display text-kohl mt-1">
            {data?.vercel.configured ? 'Connected' : 'Not configured'}
          </p>
          <p className="text-xs text-mitti mt-1 italic">
            {data?.vercel.configured
              ? 'Field changes autosave on blur'
              : 'Set VERCEL_ACCESS_TOKEN and VERCEL_PROJECT_ID on the server first'}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 border border-madder/30 bg-red-50 text-red-800 px-4 py-3 font-ui text-sm">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mt-6 border border-neem/30 bg-green-50 text-green-800 px-4 py-3 font-ui text-sm">
          {notice}
        </div>
      ) : null}

      <div className="bg-beige p-6 mt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="label text-madder">RUNTIME HEALTH</p>
            <p className="font-ui text-sm text-mitti mt-1">
              Live status from the current server runtime.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="px-4 py-2 border border-kohl/15 hover:bg-white font-ui text-sm"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          {RUNTIME_LABELS.map((item) => {
            const ok = !!data?.runtimeStatus?.[item.key];
            return (
              <div key={item.key} className="bg-white border border-kohl/10 p-4">
                <p className="label text-mitti">{item.label}</p>
                <p className={`font-display mt-2 ${ok ? 'text-neem' : 'text-madder'}`}>
                  {ok ? 'Configured' : 'Missing'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-8 mt-8">
        {SECTIONS.map((section) => (
          <section key={section.id} className="bg-beige p-6">
            <p className="label text-madder">{section.title}</p>
            <p className="font-ui text-sm text-mitti mt-1">{section.helper}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {section.keys.map((key) => {
                const meta = fieldMap.get(key);
                const dirty = (form[key] || '') !== (original[key] || '');
                const saving = savingKey === key || savingKey === '__bulk__';

                return (
                  <div key={key} className="bg-white border border-kohl/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <label className="font-ui text-sm text-kohl">{LABELS[key] || key}</label>
                      <span className={`text-xs ${meta?.configured ? 'text-neem' : 'text-mitti'}`}>
                        {saving ? 'Savingâ€¦' : meta?.configured ? 'Configured' : 'Empty'}
                      </span>
                    </div>
                    <input
                      type={meta?.secret ? 'password' : 'text'}
                      value={form[key] || ''}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, [key]: e.target.value }));
                        setNotice('');
                      }}

                      disabled={!data?.canEdit}
                      placeholder={meta?.secret ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢' : ''}
                      className="w-full mt-3 border border-kohl/15 px-3 py-2 bg-white font-ui text-sm"
                    />
                    <p className="font-ui text-xs text-mitti mt-2">
                      {data?.canEdit
                        ? dirty
                          ? 'Unsaved change. Click Save to persist this field.'
                          : 'Saved value loaded.'
                        : 'Read-only. SUPER_ADMIN required for editing.'}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}