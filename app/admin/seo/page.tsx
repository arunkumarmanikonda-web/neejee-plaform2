'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Globe2, Search, Share2, ShieldCheck, Sparkles, Wand2, ClipboardCheck } from 'lucide-react';
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
  runtimeStatus?: { openai?: boolean };
  fields?: SettingsField[];
  error?: string;
};

type DraftResponse = {
  ok?: boolean;
  configured?: boolean;
  note?: string;
  rationale?: string[];
  values?: Partial<Record<SeoFieldKey, string>>;
  error?: string;
};

type AuditPayload = {
  score: number;
  summary: string;
  wins: string[];
  issues: string[];
  nextActions: string[];
};

type AuditResponse = {
  ok?: boolean;
  configured?: boolean;
  audit?: AuditPayload;
  error?: string;
};

const DEFAULT_VALUES = SEO_FIELD_ORDER.reduce((acc, key) => {
  acc[key] = SEO_FIELD_META[key].defaultValue;
  return acc;
}, {} as Record<SeoFieldKey, string>);

const EMPTY_AUDIT: AuditPayload = {
  score: 0,
  summary: '',
  wins: [],
  issues: [],
  nextActions: [],
};

export const dynamic = 'force-dynamic';

export default function AdminSeoControlPlanePage() {
  const [values, setValues] = useState<Record<SeoFieldKey, string>>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [vercelConfigured, setVercelConfigured] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [aiObjective, setAiObjective] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiAuditing, setAiAuditing] = useState(false);
  const [rationale, setRationale] = useState<string[]>([]);
  const [audit, setAudit] = useState<AuditPayload>(EMPTY_AUDIT);

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
          setAiConfigured(Boolean(data.runtimeStatus?.openai));
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load SEO settings');
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
          'SEO values were sent to Vercel. Redeploy if you need updated metadata everywhere immediately.',
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to save SEO settings');
    } finally {
      setSaving(false);
    }
  };

  const generateDraft = async () => {
    setAiGenerating(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/admin/seo/ai-draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: aiObjective,
          values,
        }),
      });
      const data = (await res.json()) as DraftResponse;
      if (!res.ok) throw new Error(data?.error || 'AI draft failed');

      const next = { ...values };
      for (const key of SEO_FIELD_ORDER) {
        const candidate = data.values?.[key];
        if (typeof candidate === 'string' && candidate.trim()) {
          next[key] = candidate;
        }
      }

      setValues(next);
      setRationale(Array.isArray(data.rationale) ? data.rationale : []);
      setNotice(
        data.note ||
          (data.configured
            ? 'AI draft applied to the SEO form. Review and save when ready.'
            : 'Fallback draft applied. Add OPENAI_API_KEY for model-generated suggestions.')
      );
    } catch (e: any) {
      setError(e?.message || 'AI draft failed');
    } finally {
      setAiGenerating(false);
    }
  };

  const runAudit = async () => {
    setAiAuditing(true);
    setError('');
    try {
      const res = await fetch('/api/admin/seo/ai-audit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      });
      const data = (await res.json()) as AuditResponse;
      if (!res.ok) throw new Error(data?.error || 'AI audit failed');
      if (data.audit) setAudit(data.audit);
      setNotice(
        data.configured
          ? 'AI audit completed.'
          : 'Fallback SEO audit completed. Add OPENAI_API_KEY for model-generated review.'
      );
    } catch (e: any) {
      setError(e?.message || 'AI audit failed');
    } finally {
      setAiAuditing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label text-madder">SEO-001 · CONTROL PLANE</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Search metadata control center</h1>
          <p className="font-ui text-sm text-mitti mt-3 max-w-4xl leading-7">
            Centralize the default search footprint for the storefront: title, description, keywords, canonical base,
            social preview copy, preview image, robots behavior, and AI-assisted SEO drafting.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/integrations/meta"
            className="inline-flex items-center rounded-full border border-kohl/15 bg-white px-4 py-2 font-ui text-xs tracking-[0.18em] text-kohl transition hover:border-kohl/40 hover:bg-beige/40"
          >
            META ACCOUNTS
          </Link>
          <Link
            href="/admin/marketing-studio"
            className="inline-flex items-center rounded-full border border-kohl/15 bg-white px-4 py-2 font-ui text-xs tracking-[0.18em] text-kohl transition hover:border-kohl/40 hover:bg-beige/40"
          >
            MARKETING STUDIO
          </Link>
        </div>
      </div>

      <div className="grid xl:grid-cols-5 gap-4">
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
          <p className="font-display text-kohl mt-2 break-all">{values.NEXT_PUBLIC_CANONICAL_BASE_URL}</p>
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

        <div className="bg-beige border border-mitti/15 rounded-xl p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-madder" />
            <p className="label text-madder">AI STATUS</p>
          </div>
          <p className="font-display text-kohl mt-2">
            {aiConfigured ? 'OpenAI available' : 'Fallback mode'}
          </p>
          <p className="text-xs text-mitti mt-2 italic">
            {aiConfigured
              ? 'Draft and audit actions use the configured text model.'
              : 'Draft and audit still work with deterministic heuristics.'}
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
                {saving ? 'Saving...' : 'Save SEO settings'}
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
          <section className="bg-white border border-mitti/15 rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-madder" />
              <p className="label text-madder">AI DRAFT</p>
            </div>
            <p className="font-ui text-sm text-mitti mt-2 leading-6">
              Tell AI what this metadata should optimize for, then apply a complete draft across search and social fields.
            </p>
            <textarea
              value={aiObjective}
              onChange={(e) => setAiObjective(e.target.value)}
              rows={4}
              placeholder="Example: tighten positioning for Indian craft discovery, gift intent, and founder-led premium trust"
              className="mt-4 w-full rounded-xl border border-mitti/20 bg-ivory px-4 py-3 text-sm text-kohl outline-none focus:border-madder"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void generateDraft()}
                disabled={loading || aiGenerating}
                className="inline-flex items-center rounded-lg bg-madder px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {aiGenerating ? 'Generating draft...' : 'Generate AI draft'}
              </button>
              <button
                type="button"
                onClick={() => void runAudit()}
                disabled={loading || aiAuditing}
                className="inline-flex items-center rounded-lg border border-kohl/15 bg-white px-4 py-2 text-sm text-kohl disabled:opacity-50"
              >
                {aiAuditing ? 'Running audit...' : 'Run AI audit'}
              </button>
            </div>

            {rationale.length ? (
              <div className="mt-5 rounded-xl border border-mitti/15 bg-beige px-4 py-4">
                <p className="label text-madder">AI NOTES</p>
                <ul className="mt-3 space-y-2 text-sm text-kohl">
                  {rationale.map((item, idx) => (
                    <li key={`${item}-${idx}`} className="flex gap-2">
                      <span className="mt-[2px] text-madder">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="bg-beige border border-mitti/15 rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-madder" />
              <p className="label text-madder">AI AUDIT</p>
            </div>
            <h2 className="font-display text-2xl text-kohl mt-2">
              {audit.summary || 'Run the audit to score the current SEO baseline'}
            </h2>
            <p className="font-ui text-sm text-mitti mt-2">
              Score: <span className="font-semibold text-kohl">{audit.score}/100</span>
            </p>

            <div className="mt-4 grid gap-4">
              <div>
                <p className="label text-madder">WINS</p>
                <ul className="mt-2 space-y-2 text-sm text-kohl">
                  {(audit.wins.length ? audit.wins : ['No audit run yet.']).map((item, idx) => (
                    <li key={`win-${idx}`} className="flex gap-2">
                      <span className="mt-[2px] text-emerald-700">+</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="label text-madder">ISSUES</p>
                <ul className="mt-2 space-y-2 text-sm text-kohl">
                  {(audit.issues.length ? audit.issues : ['No audit run yet.']).map((item, idx) => (
                    <li key={`issue-${idx}`} className="flex gap-2">
                      <span className="mt-[2px] text-red-700">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="label text-madder">NEXT ACTIONS</p>
                <ul className="mt-2 space-y-2 text-sm text-kohl">
                  {(audit.nextActions.length ? audit.nextActions : ['No audit run yet.']).map((item, idx) => (
                    <li key={`action-${idx}`} className="flex gap-2">
                      <span className="mt-[2px] text-madder">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="bg-beige border border-mitti/15 rounded-2xl p-6">
            <p className="label text-madder">LIVE PREVIEW</p>
            <h2 className="font-display text-2xl text-kohl mt-2">{values.NEXT_PUBLIC_DEFAULT_META_TITLE}</h2>
            <p className="text-xs text-emerald-700 mt-2">{values.NEXT_PUBLIC_CANONICAL_BASE_URL}</p>
            <p className="font-ui text-sm text-mitti mt-3 leading-6">{values.NEXT_PUBLIC_DEFAULT_META_DESCRIPTION}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-mitti/20 bg-white px-3 py-1 text-[11px] text-kohl"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </section>

          <section className="bg-white border border-mitti/15 rounded-2xl p-6">
            <p className="label text-madder">SOCIAL PREVIEW</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-mitti/15 bg-ivory">
              <div className="aspect-[1.91/1] bg-beige flex items-center justify-center text-xs text-mitti px-6 text-center">
                {values.NEXT_PUBLIC_OG_IMAGE_URL || 'Default OG image URL'}
              </div>
              <div className="border-t border-mitti/15 bg-white px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-mitti">
                  {values.NEXT_PUBLIC_SITE_NAME}
                </p>
                <h3 className="font-display text-kohl text-lg mt-2">{values.NEXT_PUBLIC_OG_TITLE}</h3>
                <p className="font-ui text-sm text-mitti mt-2 leading-6">{values.NEXT_PUBLIC_OG_DESCRIPTION}</p>
              </div>
            </div>
          </section>

          <section className="bg-white border border-mitti/15 rounded-2xl p-6">
            <p className="label text-madder">RELATED SURFACES</p>
            <div className="mt-4 grid gap-2 text-sm">
              <Link href="/admin/cms" className="text-kohl hover:text-madder">CMS Pages</Link>
              <Link href="/admin/taxonomy" className="text-kohl hover:text-madder">Taxonomy</Link>
              <Link href="/admin/settings" className="text-kohl hover:text-madder">Core Settings</Link>
              <Link href="/admin/marketing-studio" className="text-kohl hover:text-madder">Marketing Studio</Link>
              <Link href="/admin/integrations/meta" className="text-kohl hover:text-madder">Meta Accounts</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}