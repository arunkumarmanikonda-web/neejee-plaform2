'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ApiField = {
  key: string;
  value: string;
  configured: boolean;
  source?: 'runtime' | 'vercel' | 'runtime+vercel' | 'missing';
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
    helper: 'Shiprocket, AiSensy WhatsApp, and Resend email providers.',
    keys: ['SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD', 'AISENSY_API_KEY', 'AISENSY_NUMBER', 'RESEND_API_KEY'],
  },
  {
    id: 'ai',
    title: 'AI services',
    helper: 'Models, recovery routing, and legacy image pipelines.',
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
  AISENSY_API_KEY: 'AiSensy API key',
  AISENSY_NUMBER: 'AiSensy number',
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
  { key: 'aisensy', label: 'AiSensy' },
  { key: 'openai', label: 'OpenAI' },
  { key: 'fal', label: 'FAL' },
  { key: 'replicate', label: 'Replicate' },
  { key: 'sms', label: 'SMS provider' },
];

function RuntimeMiniCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="bg-beige border border-kohl/10 p-4">
      <p className="label text-madder">{label}</p>
      <p className="font-display text-kohl mt-2">{value}</p>
      <p className="text-xs text-mitti mt-2 italic">{helper}</p>
    </div>
  );
}

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

      const secretKeys = new Set(
        (data?.fields || []).filter((field) => field.secret).map((field) => field.key),
      );

      setForm((prev) => {
        const next = { ...prev };
        for (const key of keys) {
          if (secretKeys.has(key) && (payload[key] || '').trim()) next[key] = '';
        }
        return next;
      });
      setOriginal((prev) => {
        const next = { ...prev };
        for (const key of keys) {
          next[key] = secretKeys.has(key) ? '' : (payload[key] || '');
        }
        return next;
      });
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          fields: prev.fields.map((field) => {
            if (!Object.prototype.hasOwnProperty.call(payload, field.key)) return field;
            const entered = (payload[field.key] || '').trim();
            if (!entered) return field;
            return {
              ...field,
              value: field.secret ? '' : payload[field.key],
              configured: true,
              source: 'vercel',
            };
          }),
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
    return <div className="p-8 font-ui text-sm text-kohl/70">Loading settings</div>;
  }

  const openaiOn = !!data?.runtimeStatus?.openai;
  const falOn = !!data?.runtimeStatus?.fal;
  const replicateOn = !!data?.runtimeStatus?.replicate;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <p className="label text-madder">CONFIG</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Settings</h1>
      <p className="font-italic italic text-mitti mt-2">
        Environment sync, provider credentials, and runtime health.
      </p>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mt-8">
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
        <Link href="/admin/seo" className="bg-beige p-5 hover:bg-madder/10 border border-mitti/15 hover:border-madder transition-colors">
          <p className="label text-madder">SEO</p>
          <p className="font-display text-kohl mt-1">Metadata control plane</p>
          <p className="text-xs text-mitti mt-1 italic">Title, OG, canonical, robots</p>
        </Link>
        <Link href="/admin/ai" className="bg-beige p-5 hover:bg-madder/10 border border-mitti/15 hover:border-madder transition-colors">
          <p className="label text-madder">AI MANAGER</p>
          <p className="font-display text-kohl mt-1">Recovery and surfaces</p>
          <p className="text-xs text-mitti mt-1 italic">Open live AI tools and recovery access routes</p>
        </Link>
        <Link href="/admin/releases" className="bg-beige p-5 hover:bg-madder/10 border border-mitti/15 hover:border-madder transition-colors">
          <p className="label text-madder">RELEASE CONTROL</p>
          <p className="font-display text-kohl mt-1">Evolution queue</p>
          <p className="text-xs text-mitti mt-1 italic">Review autonomous proposals, evidence and rollback</p>
        </Link>
        <div className="bg-beige p-5 border border-mitti/15">
          <p className="label text-madder">VERCEL SYNC</p>
          <p className="font-display text-kohl mt-1">
            {data?.vercel.configured ? 'Connected' : 'Not configured'}
          </p>
          <p className="text-xs text-mitti mt-1 italic">
            {data?.vercel.configured
              ? 'Click Save for each changed field'
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

      <div id="ai-recovery" className="bg-white border border-kohl/10 p-6 mt-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label text-madder">AI RECOVERY CONTROL</p>
            <h2 className="font-display text-3xl text-kohl mt-2">Runtime keys and live recovery surfaces</h2>
            <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
              Use AI Manager when a direct admin surface is blocked in production. This strip keeps runtime key status and live recovery access in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/ai" className="bg-kohl text-ivory px-4 py-2 rounded-sm text-sm font-medium">
              AI MANAGER
            </Link>
            <Link href="/admin/releases" className="bg-madder text-ivory px-4 py-2 rounded-sm text-sm font-medium">
              RELEASE CONTROL
            </Link>
            <Link href="/admin/cms/ai" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-white">
              CMS AI BATCH
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mt-5">
          <RuntimeMiniCard label="OPENAI" value={openaiOn ? 'Configured' : 'Missing'} helper="SEO, CMS, taxonomy, and planning text AI" />
          <RuntimeMiniCard label="FAL" value={falOn ? 'Configured' : 'Missing'} helper="Image generation and creative AI stack" />
          <RuntimeMiniCard label="REPLICATE" value={replicateOn ? 'Configured' : 'Missing'} helper="Legacy image fallback" />
          <RuntimeMiniCard label="TAXONOMY ACCESS" value="Live via AI Manager" helper="Use /admin/ai?surface=taxonomy if direct route fails" />
          <RuntimeMiniCard label="META ACCESS" value="Live via AI Manager" helper="Use /admin/ai?surface=meta if direct route fails" />
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <Link href="/admin/ai" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-beige">
            OPEN AI MANAGER
          </Link>
          <Link href="/admin/releases" className="border border-madder/40 px-4 py-2 rounded-sm text-sm font-medium text-madder bg-beige">
            OPEN RELEASE CONTROL
          </Link>
          <Link href="/admin/cms/ai" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-beige">
            OPEN CMS AI BATCH
          </Link>
          <Link href="/admin/ai?surface=taxonomy" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-beige">
            OPEN TAXONOMY RECOVERY
          </Link>
          <Link href="/admin/ai?surface=meta" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-beige">
            OPEN META RECOVERY
          </Link>
          <Link href="/admin/seo" className="border border-kohl/20 px-4 py-2 rounded-sm text-sm font-medium text-kohl bg-beige">
            OPEN SEO CONTROL PLANE
          </Link>
        </div>
      </div>

      <div className="space-y-8 mt-8">
        {SECTIONS.map((section) => (
          <section key={section.id} className="bg-beige p-6">
            <p className="label text-madder">{section.title}</p>
            <p className="font-ui text-sm text-mitti mt-1">{section.helper}</p>

            {section.id === 'ai' ? (
              <div className="mt-4 rounded-xl border border-kohl/10 bg-white p-4">
                <p className="label text-madder">AI OPERATIONS LINKS</p>
                <p className="font-ui text-sm text-mitti mt-2 leading-7">
                  If AI text or image surfaces are behaving unexpectedly, refresh runtime health and use the AI Manager recovery entrypoints below.
                </p>
                <div className="flex flex-wrap gap-3 mt-4">
                  <Link href="/admin/ai" className="bg-kohl text-ivory px-4 py-2 rounded-sm text-xs font-medium">
                    AI MANAGER
                  </Link>
                  <Link href="/admin/releases" className="bg-madder text-ivory px-4 py-2 rounded-sm text-xs font-medium">
                    RELEASE CONTROL
                  </Link>
                  <Link href="/admin/cms/ai" className="border border-kohl/20 px-4 py-2 rounded-sm text-xs font-medium text-kohl bg-beige">
                    CMS AI BATCH
                  </Link>
                  <Link href="/admin/ai?surface=taxonomy" className="border border-kohl/20 px-4 py-2 rounded-sm text-xs font-medium text-kohl bg-beige">
                    TAXONOMY RECOVERY
                  </Link>
                  <Link href="/admin/ai?surface=meta" className="border border-kohl/20 px-4 py-2 rounded-sm text-xs font-medium text-kohl bg-beige">
                    META RECOVERY
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {section.keys.map((key) => {
                const meta = fieldMap.get(key);
                const dirty = (form[key] || '') !== (original[key] || '');
                const saving = savingKey === key || savingKey === '__bulk__';
                const hasVisibleValue = !!(form[key] || '').trim();

                return (
                  <div key={key} className="bg-white border border-kohl/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <label className="font-ui text-sm text-kohl">{LABELS[key] || key}</label>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${meta?.configured ? 'text-neem' : 'text-mitti'}`}>
                          {saving ? 'Saving' : meta?.configured ? 'Configured' : 'Missing'}
                        </span>
                        {data?.canEdit ? (
                          <button
                            type="button"
                            onClick={() => void saveKeys([key])}
                            disabled={!dirty || saving}
                            className="px-2 py-1 text-xs border border-kohl/20 hover:bg-beige disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving ? 'Saving' : 'Save'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <input
                      type={meta?.secret ? 'password' : 'text'}
                      value={form[key] || ''}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, [key]: e.target.value }));
                        setNotice('');
                      }}
                      disabled={!data?.canEdit}
                      placeholder={meta?.secret && meta?.configured ? 'Configured value hidden' : ''}
                      autoComplete="off"
                      className="w-full mt-3 border border-kohl/15 px-3 py-2 bg-white font-ui text-sm"
                    />
                    <p className="font-ui text-xs text-mitti mt-2">
                      {!data?.canEdit
                        ? 'Read-only. SUPER_ADMIN required for editing.'
                        : dirty
                          ? 'Unsaved change. Click Save to persist this field.'
                          : meta?.secret && meta?.configured
                            ? 'Configured value is intentionally hidden. Enter a new value only to replace it.'
                            : meta?.configured && !hasVisibleValue
                              ? 'Configured in the runtime or Vercel. Enter a value only if you want to replace it.'
                              : meta?.configured
                                ? 'Configured value loaded.'
                                : 'Not configured yet.'}
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
