'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Copy, Check, Power } from 'lucide-react';
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

export default function AdminCampaigns() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/campaigns', { credentials: 'include', cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d.error) setErr(d.error); else setCoupons(d.coupons); })
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

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  const totalRevenue = coupons.reduce((s, c) => s + c.revenue, 0);
  const totalRedemptions = coupons.reduce((s, c) => s + c.redemptionCount, 0);
  const activeCount = coupons.filter(c => c.active).length;

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="label text-madder">GENERIC CODES</p>
          <h1 className="font-display text-4xl text-kohl">Campaigns</h1>
          <p className="font-italic italic text-mitti mt-1">Codes that travel — for newsletters, influencers, founders.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW CAMPAIGN
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-beige p-5">
          <p className="label text-mitti">ACTIVE CODES</p>
          <p className="font-display text-3xl text-kohl mt-2">{activeCount}</p>
        </div>
        <div className="bg-beige p-5">
          <p className="label text-mitti">REDEMPTIONS</p>
          <p className="font-display text-3xl text-kohl mt-2">{totalRedemptions}</p>
        </div>
        <div className="bg-kohl text-ivory p-5">
          <p className="label text-banarasi">REVENUE DRIVEN</p>
          <p className="font-display text-3xl mt-2">{formatINR(totalRevenue)}</p>
        </div>
      </div>

      {err && <div className="bg-haldi/20 text-haldi p-3 text-sm">{err}</div>}

      {/* Table */}
      <section className="bg-beige overflow-x-auto">
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
                    <span className={`text-xs px-2 py-1 ${c.active ? 'bg-neem/20 text-neem' : 'bg-mitti/20 text-mitti'}`}>
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

      {creating && <CreateModal onClose={() => { setCreating(false); load(); }} />}
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

function CreateModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [form, setForm] = useState<CampaignForm>({
    code: '',
    prefix: 'NEEJEE',
    count: 10,
    type: 'PERCENT',
    value: 10,
    minCart: 0,
    maxDiscount: '',
    maxUses: '',
    perUserOnce: true,
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);

  const save = async () => {
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/admin/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          ...form,
          minCart: form.minCart * 100,                       // rupees → paise
          value: form.type === 'PERCENT' ? form.value : form.value * 100,
          maxDiscount: form.maxDiscount ? parseInt(form.maxDiscount) * 100 : undefined,
          maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCreatedCodes(d.created.map((c: any) => c.code));
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-ivory max-w-xl w-full p-8 my-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-kohl">New Campaign</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {createdCodes.length > 0 ? (
          <div className="space-y-4">
            <p className="font-italic italic text-mitti">Created {createdCodes.length} code{createdCodes.length > 1 ? 's' : ''}:</p>
            <div className="bg-beige p-4 max-h-64 overflow-y-auto font-ui text-sm space-y-1">
              {createdCodes.map(c => <p key={c}>{c}</p>)}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(createdCodes.join('\n')); }}
              className="btn-outline w-full"
            >
              COPY ALL
            </button>
            <button onClick={onClose} className="btn-primary w-full">DONE</button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode tabs */}
            <div className="flex gap-2">
              <button onClick={() => setMode('single')} className={`flex-1 py-2 text-xs tracking-wider ${mode === 'single' ? 'bg-kohl text-ivory' : 'bg-beige'}`}>SINGLE CODE</button>
              <button onClick={() => setMode('bulk')} className={`flex-1 py-2 text-xs tracking-wider ${mode === 'bulk' ? 'bg-kohl text-ivory' : 'bg-beige'}`}>BULK GENERATE</button>
            </div>

            {mode === 'single' ? (
              <Field label="CODE" value={form.code} onChange={v => setForm({ ...form, code: v.toUpperCase() })} placeholder="DIWALI25" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="PREFIX" value={form.prefix} onChange={v => setForm({ ...form, prefix: v.toUpperCase() })} placeholder="INFLUENCER" />
                <Field label="COUNT" value={String(form.count)} onChange={v => setForm({ ...form, count: parseInt(v) || 1 })} placeholder="10" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-mitti">TYPE</label>
                <select
                  value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value as any })}
                  className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
                >
                  <option value="PERCENT">% off</option>
                  <option value="FLAT">Flat ₹ off</option>
                  <option value="FREE_SHIPPING">Free shipping</option>
                </select>
              </div>
              {form.type !== 'FREE_SHIPPING' && (
                <Field
                  label={form.type === 'PERCENT' ? 'PERCENT' : 'AMOUNT (₹)'}
                  value={String(form.value)}
                  onChange={v => setForm({ ...form, value: parseFloat(v) || 0 })}
                  placeholder={form.type === 'PERCENT' ? '10' : '500'}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="MIN CART (₹)" value={String(form.minCart)} onChange={v => setForm({ ...form, minCart: parseFloat(v) || 0 })} placeholder="0" />
              <Field label="MAX DISCOUNT (₹)" value={form.maxDiscount} onChange={v => setForm({ ...form, maxDiscount: v })} placeholder="optional" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="MAX USES" value={form.maxUses} onChange={v => setForm({ ...form, maxUses: v })} placeholder="unlimited" />
              <Field label="VALID TO" type="date" value={form.validTo} onChange={v => setForm({ ...form, validTo: v })} placeholder="" />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.perUserOnce} onChange={e => setForm({ ...form, perUserOnce: e.target.checked })} />
              <span>Limit to one redemption per customer</span>
            </label>

            {err && <p className="text-madder text-sm">{err}</p>}

            <button onClick={save} disabled={saving} className="btn-primary w-full">
              {saving ? 'CREATING...' : `CREATE ${mode === 'bulk' ? form.count + ' CODES' : 'CODE'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="label text-mitti">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 p-3 bg-beige border border-mitti/20 font-ui"
      />
    </div>
  );
}
