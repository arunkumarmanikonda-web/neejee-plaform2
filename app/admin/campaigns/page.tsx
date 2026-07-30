'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Copy, Check, Power, Sparkles, Wand2 } from 'lucide-react';
import { formatINR } from '@/lib/money';

export const dynamic = 'force-dynamic';

interface Coupon {
  id: string;
  code: string;
  type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
  value: number;
  minCart: number;
  maxDiscount: number | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  perUserOnce: boolean;
  redemptionCount: number;
  ordersCount: number;
  revenue: number;
}

type CampaignSeed = {
  mode: 'single' | 'bulk';
  code: string;
  prefix: string;
  count: number;
  type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
  value: number;
  minCart: number;
  maxDiscount: number | null;
  maxUses: number | null;
  perUserOnce: boolean;
  validFrom: string;
  validTo: string;
};

type AiPlan = {
  campaignName: string;
  strategy: string;
  recommendedMode: 'single' | 'bulk';
  code: string;
  prefix: string;
  type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
  value: number;
  minCart: number;
  maxDiscount: number | null;
  maxUses: number | null;
  perUserOnce: boolean;
  validDays: number;
  headline: string;
  description: string;
  emailSubject: string;
  instagramCaption: string;
  whatsappLine: string;
  rationale: string[];
};

function seedFromPlan(plan: AiPlan): CampaignSeed {
  const start = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + Math.max(plan.validDays, 1) * 86400000).toISOString().slice(0, 10);
  return {
    mode: plan.recommendedMode,
    code: plan.code || '',
    prefix: plan.prefix || 'NEEJEE',
    count: plan.recommendedMode === 'bulk' ? 25 : 1,
    type: plan.type,
    value: plan.value,
    minCart: plan.minCart,
    maxDiscount: plan.maxDiscount,
    maxUses: plan.maxUses,
    perUserOnce: plan.perUserOnce,
    validFrom: start,
    validTo: end,
  };
}

export default function AdminCampaigns() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [aiObjective, setAiObjective] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPlan, setAiPlan] = useState<AiPlan | null>(null);
  const [aiNotice, setAiNotice] = useState('');
  const [modalSeed, setModalSeed] = useState<CampaignSeed | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/campaigns', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        if (d.error) setErr(d.error);
        else setCoupons(d.coupons || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (id: string, active: boolean) => {
    await fetch('/api/admin/campaigns', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, active: !active }),
    });
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  const totalRevenue = useMemo(() => coupons.reduce((s, c) => s + c.revenue, 0), [coupons]);
  const totalRedemptions = useMemo(() => coupons.reduce((s, c) => s + c.redemptionCount, 0), [coupons]);
  const activeCount = useMemo(() => coupons.filter(c => c.active).length, [coupons]);

  const generateAiPlan = async () => {
    setAiGenerating(true);
    setErr('');
    setAiNotice('');
    try {
      const res = await fetch('/api/admin/campaigns/ai-plan', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: aiObjective,
          coupons: coupons.slice(0, 24).map(c => ({
            code: c.code,
            type: c.type,
            value: c.value,
            minCart: c.minCart,
            maxDiscount: c.maxDiscount,
            maxUses: c.maxUses,
            active: c.active,
            redemptionCount: c.redemptionCount,
            revenue: c.revenue,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'AI planning failed');
      setAiPlan(data.plan);
      setModalSeed(seedFromPlan(data.plan));
      setAiNotice(
        data?.configured
          ? 'AI campaign plan ready.'
          : 'Fallback campaign plan ready. Add OPENAI_API_KEY for model-generated planning.'
      );
    } catch (e: any) {
      setErr(e?.message || 'AI planning failed');
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-madder">GENERIC CODES</p>
          <h1 className="font-display text-4xl text-kohl">Campaigns</h1>
          <p className="font-italic italic text-mitti mt-1">Codes that travel — for newsletters, influencers, founders.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/admin/marketing-studio" className="px-4 py-2 border border-kohl/15 bg-white text-kohl text-sm tracking-wider hover:bg-beige/40">
            MARKETING STUDIO
          </Link>
          <Link href="/admin/seo" className="px-4 py-2 border border-kohl/15 bg-white text-kohl text-sm tracking-wider hover:bg-beige/40">
            SEO
          </Link>
          <Link href="/admin/integrations/meta" className="px-4 py-2 border border-kohl/15 bg-white text-kohl text-sm tracking-wider hover:bg-beige/40">
            META ACCOUNTS
          </Link>
          <button
            onClick={() => { setCreating(true); setModalSeed(null); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> NEW CAMPAIGN
          </button>
        </div>
      </div>

      <section className="bg-gradient-to-br from-madder/10 to-banarasi/10 border border-madder/20 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-madder" />
              <p className="label text-madder">AI CAMPAIGN PLANNER</p>
            </div>
            <h2 className="font-display text-2xl text-kohl mt-2">Draft the offer before you mint the code</h2>
            <p className="text-sm text-mitti mt-2 max-w-3xl leading-6">
              Generate a recommended discount structure, validity window, and channel-ready copy for email, Instagram, and WhatsApp.
            </p>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6 mt-5">
          <div>
            <label className="label text-mitti">OBJECTIVE</label>
            <textarea
              value={aiObjective}
              onChange={e => setAiObjective(e.target.value)}
              rows={5}
              placeholder="Example: create a founder-led gift-intent offer for dormant customers before Rakhi, protect margin, and keep the code usable in email + Instagram story."
              className="w-full mt-2 p-4 bg-ivory border border-mitti/20 rounded-xl"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={generateAiPlan}
                disabled={aiGenerating}
                className="bg-madder text-ivory px-5 py-3 text-sm tracking-wider hover:bg-madder/90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                {aiGenerating ? 'GENERATING PLAN...' : 'GENERATE AI PLAN'}
              </button>

              {aiPlan && (
                <button
                  onClick={() => setCreating(true)}
                  className="bg-kohl text-ivory px-5 py-3 text-sm tracking-wider hover:bg-kohl/90"
                >
                  USE PLAN IN NEW CAMPAIGN
                </button>
              )}
            </div>

            {err && <div className="mt-4 bg-haldi/20 text-haldi p-3 text-sm rounded-lg">{err}</div>}
            {aiNotice && <div className="mt-4 bg-neem/10 text-neem p-3 text-sm rounded-lg">{aiNotice}</div>}
          </div>

          <div className="bg-ivory border border-mitti/15 rounded-2xl p-5">
            <p className="label text-madder">PLAN OUTPUT</p>
            {!aiPlan ? (
              <p className="text-sm text-mitti mt-3">No AI plan yet. Generate one to get structure, copy, and campaign defaults.</p>
            ) : (
              <div className="space-y-5 mt-4">
                <div>
                  <h3 className="font-display text-2xl text-kohl">{aiPlan.campaignName}</h3>
                  <p className="text-sm text-mitti mt-2 leading-6">{aiPlan.strategy}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-white border border-mitti/10 rounded-xl p-3">
                    <p className="label text-mitti">MODE</p>
                    <p className="mt-2 text-kohl">{aiPlan.recommendedMode.toUpperCase()}</p>
                  </div>
                  <div className="bg-white border border-mitti/10 rounded-xl p-3">
                    <p className="label text-mitti">CODE / PREFIX</p>
                    <p className="mt-2 text-kohl">{aiPlan.recommendedMode === 'single' ? aiPlan.code : aiPlan.prefix}</p>
                  </div>
                  <div className="bg-white border border-mitti/10 rounded-xl p-3">
                    <p className="label text-mitti">DISCOUNT</p>
                    <p className="mt-2 text-kohl">
                      {aiPlan.type === 'PERCENT' && `${aiPlan.value}% off`}
                      {aiPlan.type === 'FLAT' && `${formatINR(aiPlan.value * 100)} off`}
                      {aiPlan.type === 'FREE_SHIPPING' && 'Free shipping'}
                    </p>
                  </div>
                  <div className="bg-white border border-mitti/10 rounded-xl p-3">
                    <p className="label text-mitti">WINDOW</p>
                    <p className="mt-2 text-kohl">{aiPlan.validDays} days</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="label text-madder">RATIONALE</p>
                  {aiPlan.rationale.map((item, idx) => (
                    <div key={`${item}-${idx}`} className="flex gap-2 text-kohl">
                      <span className="text-madder mt-[2px]">-</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="bg-white border border-mitti/10 rounded-xl p-3">
                    <p className="label text-mitti">EMAIL SUBJECT</p>
                    <p className="mt-2 text-kohl">{aiPlan.emailSubject}</p>
                  </div>
                  <div className="bg-white border border-mitti/10 rounded-xl p-3">
                    <p className="label text-mitti">HEADLINE</p>
                    <p className="mt-2 text-kohl">{aiPlan.headline}</p>
                  </div>
                  <div className="bg-white border border-mitti/10 rounded-xl p-3">
                    <p className="label text-mitti">INSTAGRAM CAPTION</p>
                    <p className="mt-2 text-kohl whitespace-pre-wrap">{aiPlan.instagramCaption}</p>
                  </div>
                  <div className="bg-white border border-mitti/10 rounded-xl p-3">
                    <p className="label text-mitti">WHATSAPP LINE</p>
                    <p className="mt-2 text-kohl">{aiPlan.whatsappLine}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-beige p-5 rounded-xl">
          <p className="label text-mitti">ACTIVE CODES</p>
          <p className="font-display text-3xl text-kohl mt-2">{activeCount}</p>
        </div>
        <div className="bg-beige p-5 rounded-xl">
          <p className="label text-mitti">REDEMPTIONS</p>
          <p className="font-display text-3xl text-kohl mt-2">{totalRedemptions}</p>
        </div>
        <div className="bg-kohl text-ivory p-5 rounded-xl">
          <p className="label text-banarasi">REVENUE DRIVEN</p>
          <p className="font-display text-3xl mt-2">{formatINR(totalRevenue)}</p>
        </div>
      </div>

      <section className="bg-beige overflow-x-auto rounded-xl">
        {loading ? (
          <p className="p-12 text-center font-italic italic text-mitti">Loading codes...</p>
        ) : coupons.length === 0 ? (
          <p className="p-12 text-center font-italic italic text-mitti">No campaigns yet. Create your first code.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-kohl text-ivory">
              <tr className="text-left text-xs label">
                <th className="p-3">CODE</th>
                <th className="p-3">DISCOUNT</th>
                <th className="p-3 text-right">USES</th>
                <th className="p-3 text-right">ORDERS</th>
                <th className="p-3 text-right">REVENUE</th>
                <th className="p-3">VALID</th>
                <th className="p-3">STATUS</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} className="border-b border-mitti/10">
                  <td className="p-3">
                    <button onClick={() => copy(c.code)} className="font-ui font-medium text-kohl hover:text-madder flex items-center gap-1.5">
                      {c.code}
                      {copied === c.code ? <Check className="w-3 h-3 text-neem" /> : <Copy className="w-3 h-3 opacity-40" />}
                    </button>
                    {c.perUserOnce && <p className="text-xs text-mitti italic">one per customer</p>}
                  </td>
                  <td className="p-3 font-ui">
                    {c.type === 'PERCENT' && `${c.value}% off`}
                    {c.type === 'FLAT' && `${formatINR(c.value)} off`}
                    {c.type === 'FREE_SHIPPING' && 'Free shipping'}
                    {c.minCart > 0 && <p className="text-xs text-mitti">min {formatINR(c.minCart)}</p>}
                  </td>
                  <td className="p-3 text-right">
                    {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}
                  </td>
                  <td className="p-3 text-right">{c.ordersCount}</td>
                  <td className="p-3 text-right font-ui">{formatINR(c.revenue)}</td>
                  <td className="p-3 text-xs text-mitti">
                    {new Date(c.validFrom).toISOString().slice(0, 10)}
                    {c.validTo && <> → {new Date(c.validTo).toISOString().slice(0, 10)}</>}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${c.active ? 'bg-neem/20 text-neem' : 'bg-mitti/20 text-mitti'}`}>
                      {c.active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </td>
                  <td className="p-3">
                    <button onClick={() => toggleActive(c.id, c.active)} className="text-mitti hover:text-madder" title={c.active ? 'Pause' : 'Activate'}>
                      <Power className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {creating && (
        <CreateModal
          seed={modalSeed}
          onClose={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

interface CampaignForm {
  code: string;
  prefix: string;
  count: number;
  type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
  value: number;
  minCart: number;
  maxDiscount: string;
  maxUses: string;
  perUserOnce: boolean;
  validFrom: string;
  validTo: string;
}

function CreateModal({ onClose, seed }: { onClose: () => void; seed: CampaignSeed | null }) {
  const [mode, setMode] = useState<'single' | 'bulk'>(seed?.mode || 'single');
  const [form, setForm] = useState<CampaignForm>({
    code: seed?.code || '',
    prefix: seed?.prefix || 'NEEJEE',
    count: seed?.count || 10,
    type: seed?.type || 'PERCENT',
    value: seed?.value ?? 10,
    minCart: seed?.minCart ?? 0,
    maxDiscount: seed?.maxDiscount != null ? String(seed.maxDiscount) : '',
    maxUses: seed?.maxUses != null ? String(seed.maxUses) : '',
    perUserOnce: seed?.perUserOnce ?? true,
    validFrom: seed?.validFrom || new Date().toISOString().slice(0, 10),
    validTo: seed?.validTo || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!seed) return;
    setMode(seed.mode);
    setForm({
      code: seed.code || '',
      prefix: seed.prefix || 'NEEJEE',
      count: seed.count || 10,
      type: seed.type || 'PERCENT',
      value: seed.value ?? 10,
      minCart: seed.minCart ?? 0,
      maxDiscount: seed.maxDiscount != null ? String(seed.maxDiscount) : '',
      maxUses: seed.maxUses != null ? String(seed.maxUses) : '',
      perUserOnce: seed.perUserOnce ?? true,
      validFrom: seed.validFrom || new Date().toISOString().slice(0, 10),
      validTo: seed.validTo || '',
    });
  }, [seed]);

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          ...form,
          minCart: Math.round((form.minCart || 0) * 100),
          value: form.type === 'PERCENT' ? Math.round(form.value || 0) : Math.round((form.value || 0) * 100),
          maxDiscount: form.maxDiscount ? Math.round(parseFloat(form.maxDiscount) * 100) : undefined,
          maxUses: form.maxUses ? parseInt(form.maxUses, 10) : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to create campaign');
      setCreatedCodes((d.created || []).map((c: any) => c.code));
    } catch (e: any) {
      setErr(e?.message || 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-ivory max-w-xl w-full p-8 my-auto rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-kohl">New Campaign</h2>
            <p className="text-xs text-mitti mt-1">Single code or bulk coupon generation.</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {createdCodes.length > 0 ? (
          <div className="space-y-4">
            <p className="font-italic italic text-mitti">Created {createdCodes.length} code{createdCodes.length > 1 ? 's' : ''}:</p>
            <div className="bg-beige p-4 max-h-64 overflow-y-auto font-ui text-sm space-y-1 rounded-xl">
              {createdCodes.map(c => <p key={c}>{c}</p>)}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(createdCodes.join("`n")); }} className="btn-outline w-full">
              COPY ALL
            </button>
            <button onClick={onClose} className="btn-primary w-full">DONE</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setMode('single')} className={`flex-1 py-2 text-xs tracking-wider ${mode === 'single' ? 'bg-kohl text-ivory' : 'bg-beige'}`}>SINGLE CODE</button>
              <button onClick={() => setMode('bulk')} className={`flex-1 py-2 text-xs tracking-wider ${mode === 'bulk' ? 'bg-kohl text-ivory' : 'bg-beige'}`}>BULK GENERATE</button>
            </div>

            {mode === 'single' ? (
              <Field label="CODE" value={form.code} onChange={v => setForm({ ...form, code: v.toUpperCase() })} placeholder="DIWALI25" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="PREFIX" value={form.prefix} onChange={v => setForm({ ...form, prefix: v.toUpperCase() })} placeholder="NEEJEE" />
                <Field label="COUNT" type="number" value={String(form.count)} onChange={v => setForm({ ...form, count: Math.max(1, parseInt(v || '1', 10)) })} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="TYPE"
                value={form.type}
                onChange={v => setForm({ ...form, type: v as any })}
                options={[
                  { value: 'PERCENT', label: 'Percent' },
                  { value: 'FLAT', label: 'Flat rupees' },
                  { value: 'FREE_SHIPPING', label: 'Free shipping' },
                ]}
              />
              <Field
                label={form.type === 'PERCENT' ? 'VALUE (%)' : form.type === 'FLAT' ? 'VALUE (₹)' : 'VALUE'}
                type="number"
                disabled={form.type === 'FREE_SHIPPING'}
                value={String(form.value)}
                onChange={v => setForm({ ...form, value: Number(v || 0) })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="MIN CART (₹)" type="number" value={String(form.minCart)} onChange={v => setForm({ ...form, minCart: Number(v || 0) })} />
              <Field label="MAX DISCOUNT (₹)" type="number" value={form.maxDiscount} onChange={v => setForm({ ...form, maxDiscount: v })} placeholder="optional" />
              <Field label="MAX USES" type="number" value={form.maxUses} onChange={v => setForm({ ...form, maxUses: v })} placeholder="optional" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="VALID FROM" type="date" value={form.validFrom} onChange={v => setForm({ ...form, validFrom: v })} />
              <Field label="VALID TO" type="date" value={form.validTo} onChange={v => setForm({ ...form, validTo: v })} />
            </div>

            <label className="flex items-center gap-2 text-sm text-kohl">
              <input
                type="checkbox"
                checked={form.perUserOnce}
                onChange={e => setForm({ ...form, perUserOnce: e.target.checked })}
              />
              One redemption per customer
            </label>

            {err && <div className="bg-haldi/20 text-haldi p-3 text-sm rounded-lg">{err}</div>}

            <button onClick={save} disabled={saving} className="btn-primary w-full disabled:opacity-50">
              {saving ? 'SAVING...' : 'CREATE CAMPAIGN'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="label text-mitti">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full mt-1 p-3 bg-beige border border-mitti/20 rounded-lg disabled:opacity-50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="label text-mitti">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 p-3 bg-beige border border-mitti/20 rounded-lg"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}