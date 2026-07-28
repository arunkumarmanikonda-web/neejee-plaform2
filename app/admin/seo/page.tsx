'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Globe2, Search, Share2, ShieldCheck } from 'lucide-react';
import {
  SEO_FIELD_META,
  SEO_FIELD_ORDER,
  type SeoFieldKey,
} from '@/lib/site/seo-config';

type SettingsField = {
  key: string;
  value: string;
  configured: boolean;
  secret: boolean;
};

type SettingsResponse = {
  canEdit?: boolean;
  vercel?: { configured?: boolean };
  fields?: SettingsField[];
  error?: string;
};

const DEFAULT_VALUES = SEO_FIELD_ORDER.reduce((acc, key) => {
  acc[key] = SEO_FIELD_META[key].defaultValue;
  return acc;
}, {} as Record<SeoFieldKey, string>);

export default function AdminSeoControlPlanePage() {
  const [values, setValues] = useState<Record<SeoFieldKey, string>>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [vercelConfigured, setVercelConfigured] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/admin/settings', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await res.json()) as SettingsResponse;
        if (!res.ok) throw new Error(data?.error || 'Failed to load SEO settings');

        const next = { ...DEFAULT_VALUES };
        for (const field of data.fields || []) {
          if (!SEO_FIELD_ORDER.includes(field.key as SeoFieldKey)) continue;
          const key = field.key as SeoFieldKey;
          next[key] = field.value?.trim()
            ? field.value
            : SEO_FIELD_META[key].defaultValue;
        }

        if (!cancelled) {
          setValues(next);
          setCanEdit(Boolean(data.canEdit));
          setVercelConfigured(Boolean(data.vercel?.configured));
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load SEO settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const keywords = useMemo(
    () =>
      values.NEXT_PUBLIC_META_KEYWORDS
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
    [values.NEXT_PUBLIC_META_KEYWORDS],
  );

  const handleChange = (key: SeoFieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save SEO settings');
      if (data?.failed?.length) {
        throw new Error(`Some SEO fields failed to save: ${data.failed.map((item: any) => item.key).join(', ')}`);
      }
      setNotice(
        data?.note ||
          'SEO values were sent to Vercel. Redeploy if you need the updated metadata to apply everywhere immediately.',
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to save SEO settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="label text-madder">SEO-001 · CONTROL PLANE</p>
        <h1 className="font-display text-4xl text-kohl mt-2">Search metadata control center</h1>
        <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
          Centralize the default search footprint for the storefront: title, description, keywords, canonical base,
          social preview copy, preview image, and robots behavior.
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <div className="bg-beige border border-mitti/15 rounded-xl p-5">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-madder" />
            <p className="label text-madder">SEARCH</p>
          </div>
          <p className="font-display text-kohl mt-2">Title, description, keywords</p>
          <p className="text-xs text-mitti mt-2 italic">Default fallback metadata for the storefront.</p>
        </div>

        <div className="bg-beige border border-mitti/15 rounded-xl p-5">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-madder" />
            <p className="label text-madder">SOCIAL</p>
          </div>
          <p className="font-display text-kohl mt-2">OG and Twitter preview copy</p>
          <p className="text-xs text-mitti mt-2 italic">Preview title, description, and image defaults.</p>
        </div>

        <div className="bg-beige border border-mitti/15 rounded-xl p-5">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-madder" />
            <p className="label text-madder">CANONICAL</p>
          </div>
          <p className="font-display text-kohl mt-2">{values.NEXT_PUBLIC_CANONICAL_BASE_URL}</p>
          <p className="text-xs text-mitti mt-2 italic">Used for metadataBase and absolute OG links.</p>
        </div>

        <div className="bg-beige border border-mitti/15 rounded-xl p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-madder" />
            <p className="label text-madder">VERCEL SYNC</p>
          </div>
          <p className="font-display text-kohl mt-2">
            {vercelConfigured ? 'Connected' : 'Not configured'}
          </p>
          <p className="text-xs text-mitti mt-2 italic">
            {vercelConfigured
              ? canEdit
                ? 'Saving pushes SEO env values to Vercel'
                : 'Visible here, editable by super admins only'
              : 'Set VERCEL_ACCESS_TOKEN and VERCEL_PROJECT_ID on the server first'}
          </p>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1.3fr_0.7fr] gap-8">
        <div className="space-y-6">
          <section className="bg-white border border-mitti/15 rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label text-madder">DEFAULT SEO FIELDS</p>
                <p className="font-ui text-sm text-mitti mt-2 leading-6">
                  These defaults feed the root metadata layer. Page-specific CMS SEO fields can still override title
                  and description where supported.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void save()}
                disabled={!canEdit || saving || !vercelConfigured || loading}
                className="px-4 py-2 rounded-lg bg-kohl text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save SEO settings'}
              </button>
            </div>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {notice ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {notice}
              </div>
            ) : null}

            {!canEdit && !loading ? (
              <div className="mt-5 rounded-xl border border-mitti/15 bg-beige px-4 py-3 text-sm text-mitti">
                You can review SEO configuration here, but only SUPER_ADMIN can save env-backed changes.
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 gap-5 mt-6">
              {SEO_FIELD_ORDER.map((key) => {
                const meta = SEO_FIELD_META[key];
                const multiline = Boolean(meta.multiline);

                return (
                  <label key={key} className={`block ${multiline ? 'md:col-span-2' : ''}`}>
                    <span className="label text-madder">{meta.label}</span>
                    <span className="block text-xs text-mitti mt-2 leading-5">{meta.helper}</span>

                    {multiline ? (
                      <textarea
                        value={values[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        rows={4}
                        disabled={loading}
                        placeholder={meta.placeholder}
                        className="mt-3 w-full rounded-xl border border-mitti/20 bg-ivory px-4 py-3 text-sm text-kohl outline-none focus:border-madder"
                      />
                    ) : (
                      <input
                        value={values[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        disabled={loading}
                        placeholder={meta.placeholder}
                        className="mt-3 w-full rounded-xl border border-mitti/20 bg-ivory px-4 py-3 text-sm text-kohl outline-none focus:border-madder"
                      />
                    )}

                    <p className="mt-2 font-mono text-[11px] text-mitti/80">{key}</p>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-beige border border-mitti/15 rounded-2xl p-6">
            <p className="label text-madder">LIVE PREVIEW</p>
            <h2 className="font-display text-2xl text-kohl mt-2">{values.NEXT_PUBLIC_DEFAULT_META_TITLE}</h2>
            <p className="text-sm text-emerald-700 mt-3 truncate">{values.NEXT_PUBLIC_CANONICAL_BASE_URL}</p>
            <p className="font-ui text-sm text-mitti mt-3 leading-6">
              {values.NEXT_PUBLIC_DEFAULT_META_DESCRIPTION}
            </p>

            {keywords.length ? (
              <div className="flex flex-wrap gap-2 mt-5">
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2 py-1 rounded-full bg-white border border-mitti/15 text-[10px] text-mitti"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          <section className="bg-beige border border-mitti/15 rounded-2xl p-6">
            <p className="label text-madder">SOCIAL PREVIEW</p>
            <p className="font-display text-kohl mt-2">{values.NEXT_PUBLIC_OG_TITLE}</p>
            <p className="font-ui text-sm text-mitti mt-3 leading-6">{values.NEXT_PUBLIC_OG_DESCRIPTION}</p>
            <p className="font-mono text-[11px] text-mitti/80 mt-4 break-all">
              {values.NEXT_PUBLIC_OG_IMAGE_URL}
            </p>
          </section>

          <section className="bg-beige border border-mitti/15 rounded-2xl p-6">
            <p className="label text-madder">EDITORIAL LINKS</p>
            <div className="space-y-3 mt-4">
              <Link href="/admin/cms" className="block hover:text-madder transition-colors">
                <p className="font-display text-kohl">CMS Pages</p>
                <p className="text-xs text-mitti italic mt-1">Page-specific SEO title and description overrides</p>
              </Link>
              <Link href="/admin/settings" className="block hover:text-madder transition-colors">
                <p className="font-display text-kohl">Core Settings</p>
                <p className="text-xs text-mitti italic mt-1">Env-backed settings and Vercel sync health</p>
              </Link>
              <Link href="/admin/taxonomy" className="block hover:text-madder transition-colors">
                <p className="font-display text-kohl">Taxonomy</p>
                <p className="text-xs text-mitti italic mt-1">Category structure that shapes search-facing information architecture</p>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}