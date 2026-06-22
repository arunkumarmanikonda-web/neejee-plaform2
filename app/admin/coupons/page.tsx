'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Save, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { formatINR, paiseToRupees, rupeesToPaise } from '@/lib/money';

type Coupon = {
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
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/coupons');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCoupons(d.coupons || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm('Delete this coupon?')) return;
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  const toggle = async (c: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !c.active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  const isLive = (c: Coupon) => {
    if (!c.active) return false;
    const now = new Date();
    if (c.validFrom && new Date(c.validFrom) > now) return false;
    if (c.validTo && new Date(c.validTo) < now) return false;
    if (c.maxUses && c.usedCount >= c.maxUses) return false;
    return true;
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <p className="label text-madder">PROMOTIONS</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Coupons & Offers</h1>
          <p className="font-italic italic text-mitti mt-2">{coupons.length} coupons</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW COUPON
        </button>
      </div>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

      <table className="w-full mt-8 bg-beige font-ui text-sm">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-4">CODE</th>
            <th className="p-4">TYPE</th>
            <th className="p-4">VALUE</th>
            <th className="p-4">MIN CART</th>
            <th className="p-4">USED</th>
            <th className="p-4">VALIDITY</th>
            <th className="p-4">STATUS</th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={8} className="p-8 text-center text-mitti">Loading...</td></tr>}
          {!loading && coupons.length === 0 && (
            <tr><td colSpan={8} className="p-8 text-center text-mitti italic">No coupons yet. Create your first one.</td></tr>
          )}
          {coupons.map(c => (
            <tr key={c.id} className="border-b border-mitti/10 hover:bg-ivory/50">
              <td className="p-4 font-mono text-madder font-medium">{c.code}</td>
              <td className="p-4 text-xs">{c.type.replace(/_/g, ' ')}</td>
              <td className="p-4">
                {c.type === 'PERCENT' && `${c.value}%`}
                {c.type === 'FLAT' && formatINR(c.value)}
                {c.type === 'FREE_SHIPPING' && '—'}
              </td>
              <td className="p-4">{c.minCart > 0 ? formatINR(c.minCart) : '—'}</td>
              <td className="p-4 text-xs">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
              <td className="p-4 text-xs text-mitti">
                {new Date(c.validFrom).toLocaleDateString('en-IN')}
                {c.validTo && ` → ${new Date(c.validTo).toLocaleDateString('en-IN')}`}
              </td>
              <td className="p-4">
                <button onClick={() => toggle(c)}
                  className={`badge-founder ${isLive(c) ? 'bg-neem' : 'bg-mitti'}`}>
                  {isLive(c) ? 'LIVE' : c.active ? 'SCHEDULED' : 'PAUSED'}
                </button>
              </td>
              <td className="p-4 text-right">
                <button onClick={() => remove(c.id)} className="text-monsoon hover:text-madder">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </>
  );
}

function CreateModal({ onClose, onCreated }: any) {
  const [form, setForm] = useState<{
    code: string; type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
    valuePct: number; valuePaise: number;
    minCartPaise: number; maxDiscountPaise: number; maxUses: number;
    validFrom: string; validTo: string; active: boolean;
  }>({
    code: '', type: 'PERCENT', valuePct: 10, valuePaise: 0,
    minCartPaise: 0, maxDiscountPaise: 0, maxUses: 0,
    validFrom: '', validTo: '', active: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const body: any = {
        code: form.code,
        type: form.type,
        active: form.active,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        minCart: form.minCartPaise,
      };
      if (form.type === 'PERCENT') {
        body.value = form.valuePct;
        body.maxDiscount = form.maxDiscountPaise || undefined;
      } else if (form.type === 'FLAT') {
        body.value = form.valuePaise;
      } else {
        body.value = 0; // FREE_SHIPPING
      }
      if (form.maxUses) body.maxUses = form.maxUses;
      const res = await fetch('/api/admin/coupons', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-6">
      <form onSubmit={submit} className="bg-ivory max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-mitti/20">
          <h2 className="font-display text-2xl text-kohl">New Coupon</h2>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-mitti" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="font-ui text-xs text-madder bg-madder/10 p-2">{error}</p>}
          <div>
            <label className="label text-mitti block mb-1">Code *</label>
            <input required value={form.code} onChange={e => setForm((f: any) => ({ ...f, code: e.target.value.toUpperCase()}))}
              placeholder="WELCOME10" className="w-full p-3 bg-beige border border-mitti/20 font-mono text-sm uppercase" />
          </div>
          <div>
            <label className="label text-mitti block mb-1">Type *</label>
            <select value={form.type} onChange={e => setForm((f: any) => ({ ...f, type: e.target.value as any}))}
              className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm">
              <option value="PERCENT">Percentage Off</option>
              <option value="FLAT">Flat Amount Off</option>
              <option value="FREE_SHIPPING">Free Shipping</option>
            </select>
          </div>
          {form.type === 'PERCENT' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-mitti block mb-1">Discount %</label>
                <input type="number" min="0" max="100" value={form.valuePct}
                  onChange={e => setForm((f: any) => ({ ...f, valuePct: parseInt(e.target.value) || 0}))}
                  className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
              </div>
              <div>
                <label className="label text-mitti block mb-1">Max Discount Cap (₹)</label>
                <input type="number" min="0" value={paiseToRupees(form.maxDiscountPaise)}
                  onChange={e => setForm((f: any) => ({ ...f, maxDiscountPaise: rupeesToPaise(e.target.value)}))}
                  placeholder="0 = no cap" className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
              </div>
            </div>
          )}
          {form.type === 'FLAT' && (
            <div>
              <label className="label text-mitti block mb-1">Discount Amount (₹)</label>
              <input type="number" min="0" value={paiseToRupees(form.valuePaise)}
                onChange={e => setForm((f: any) => ({ ...f, valuePaise: rupeesToPaise(e.target.value)}))}
                className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
            </div>
          )}
          <div>
            <label className="label text-mitti block mb-1">Min Cart Value (₹)</label>
            <input type="number" min="0" value={paiseToRupees(form.minCartPaise)}
              onChange={e => setForm((f: any) => ({ ...f, minCartPaise: rupeesToPaise(e.target.value)}))}
              placeholder="0 = no minimum" className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-mitti block mb-1">Valid From</label>
              <input type="datetime-local" value={form.validFrom}
                onChange={e => setForm((f: any) => ({ ...f, validFrom: e.target.value}))}
                className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
            </div>
            <div>
              <label className="label text-mitti block mb-1">Valid To</label>
              <input type="datetime-local" value={form.validTo}
                onChange={e => setForm((f: any) => ({ ...f, validTo: e.target.value}))}
                className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
            </div>
          </div>
          <div>
            <label className="label text-mitti block mb-1">Max Uses (0 = unlimited)</label>
            <input type="number" min="0" value={form.maxUses}
              onChange={e => setForm((f: any) => ({ ...f, maxUses: parseInt(e.target.value) || 0}))}
              className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          </div>
          <label className="flex items-center gap-2 font-ui text-sm">
            <input type="checkbox" checked={form.active} onChange={e => setForm((f: any) => ({ ...f, active: e.target.checked}))} />
            Active
          </label>

          <BannerCopyHelper form={form} />
        </div>
        <div className="border-t border-mitti/20 p-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline">CANCEL</button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'CREATING...' : 'CREATE COUPON'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// "DRAFT BANNER COPY WITH AI" — generates headline + subtitle + CTA
// from the coupon configuration. The admin can copy-paste it into a
// Banner row on /admin/banners.
function BannerCopyHelper({ form }: { form: any }) {
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{ headline?: string; subtitle?: string; ctaText?: string } | null>(null);
  const [error, setError] = useState('');

  const discountLabel =
    form.type === 'PERCENT' ? `${form.valuePct}% off`
    : form.type === 'FLAT' ? `${paiseToRupees(form.valuePaise)} off`
    : form.type === 'FREE_SHIPPING' ? 'Free shipping'
    : '';

  const run = async () => {
    setDrafting(true); setError(''); setDraft(null);
    try {
      const res = await fetch('/api/ai/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          field: 'couponBanner',
          code: form.code,
          discount: discountLabel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'AI failed');
      if (data.configured === false) {
        setError('AI not configured (OPENAI_API_KEY missing).');
        return;
      }
      setDraft(data.json || null);
    } catch (e: any) {
      setError(e?.message || 'AI failed');
    } finally {
      setDrafting(false);
    }
  };

  const copy = (s: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(s);
  };

  if (!form.code) return null;

  return (
    <div className="border border-madder/30 bg-madder/5 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="label text-madder">BANNER COPY (OPTIONAL)</p>
        <button type="button" onClick={run} disabled={drafting}
          className="inline-flex items-center gap-1.5 text-xs font-ui tracking-widest text-madder hover:text-kohl disabled:opacity-50">
          {drafting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {drafting ? 'DRAFTING…' : '✦ DRAFT WITH AI'}
        </button>
      </div>
      <p className="text-[11px] text-mitti italic">
        Generates a headline/subtitle/CTA you can paste into a banner. Uses your code <strong className="font-mono">{form.code}</strong> and {discountLabel || 'this offer'}.
      </p>
      {error && <p className="text-[11px] text-madder mt-1">{error}</p>}
      {draft && (
        <div className="mt-2 grid gap-2 text-xs">
          {draft.headline && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-mitti w-16">Headline</span>
              <span className="font-display text-kohl flex-1">{draft.headline}</span>
              <button type="button" onClick={() => copy(draft.headline!)} className="text-[10px] text-madder hover:underline">copy</button>
            </div>
          )}
          {draft.subtitle && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-mitti w-16">Subtitle</span>
              <span className="italic text-mitti flex-1">{draft.subtitle}</span>
              <button type="button" onClick={() => copy(draft.subtitle!)} className="text-[10px] text-madder hover:underline">copy</button>
            </div>
          )}
          {draft.ctaText && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-mitti w-16">CTA</span>
              <span className="bg-kohl text-ivory text-[10px] tracking-widest px-2 py-0.5 flex-1 inline-block w-fit">{draft.ctaText}</span>
              <button type="button" onClick={() => copy(draft.ctaText!)} className="text-[10px] text-madder hover:underline">copy</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
