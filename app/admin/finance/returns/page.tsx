'use client';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/money';
import { Plus, Loader2 } from 'lucide-react';

type ReturnRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  returnedOn: string;
  refundedOn: string | null;
  refundedAmountPaise: number;
  reverseShippingPaise: number;
  damagedValuePaise: number;
  restockedValuePaise: number;
  reason: string | null;
  notes: string | null;
};

export default function ReturnsPage() {
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/admin/finance/returns');
    const j = await r.json();
    setRows(j.returns || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const totalRefunded = rows.reduce((s, r) => s + r.refundedAmountPaise, 0);
  const totalRestocked = rows.reduce((s, r) => s + r.restockedValuePaise, 0);
  const totalDamaged = rows.reduce((s, r) => s + r.damagedValuePaise, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-2xl text-kohl">Returns ledger</h2>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest">
          <Plus className="w-3 h-3" /> {showNew ? 'CLOSE' : 'RECORD RETURN'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Kpi label="TOTAL REFUNDED" value={formatINR(totalRefunded)} />
        <Kpi label="RESTOCKED VALUE" value={formatINR(totalRestocked)} sub="back into COGS" />
        <Kpi label="DAMAGED WRITE-OFF" value={formatINR(totalDamaged)} />
      </div>

      {showNew && <NewReturnForm onSaved={() => { setShowNew(false); load(); }} />}

      {loading ? (
        <div className="text-mitti py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti">No returns recorded yet.</div>
      ) : (
        <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">RETURNED</th>
                <th className="text-left p-3">ORDER</th>
                <th className="text-right p-3">REFUND</th>
                <th className="text-right p-3">REV. SHIP</th>
                <th className="text-right p-3">RESTOCKED</th>
                <th className="text-right p-3">DAMAGED</th>
                <th className="text-left p-3">REASON</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-mitti/10">
                  <td className="p-3 text-mitti text-xs whitespace-nowrap">
                    {new Date(r.returnedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="p-3 text-kohl">{r.orderNumber}</td>
                  <td className="p-3 text-right tabular-nums">{formatINR(r.refundedAmountPaise)}</td>
                  <td className="p-3 text-right tabular-nums text-mitti">{formatINR(r.reverseShippingPaise)}</td>
                  <td className="p-3 text-right tabular-nums text-emerald-700">{formatINR(r.restockedValuePaise)}</td>
                  <td className="p-3 text-right tabular-nums text-madder">{formatINR(r.damagedValuePaise)}</td>
                  <td className="p-3 text-mitti text-xs">{r.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-ivory border border-mitti/20 p-5 rounded">
      <p className="label text-banarasi text-[10px]">{label}</p>
      <p className="font-display text-2xl text-kohl mt-2">{value}</p>
      {sub && <p className="text-mitti text-xs mt-1">{sub}</p>}
    </div>
  );
}

function NewReturnForm({ onSaved }: { onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    orderNumber: '',
    returnedOn: today,
    refundedOn: today,
    refundedAmount: '',
    reverseShippingAmount: '',
    damagedAmount: '',
    restockedAmount: '',
    reason: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      // Look up orderId from orderNumber
      const orderR = await fetch(`/api/admin/orders/${encodeURIComponent(form.orderNumber)}`);
      if (!orderR.ok) throw new Error('Order not found');
      const orderJ = await orderR.json();
      const orderId = orderJ?.order?.id || orderJ?.id;
      if (!orderId) throw new Error('Could not resolve order id');

      const r = await fetch('/api/admin/finance/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderNumber: form.orderNumber,
          returnedOn: form.returnedOn,
          refundedOn: form.refundedOn || null,
          refundedAmountPaise: Math.round(parseFloat(form.refundedAmount || '0') * 100),
          reverseShippingPaise: Math.round(parseFloat(form.reverseShippingAmount || '0') * 100),
          damagedValuePaise: Math.round(parseFloat(form.damagedAmount || '0') * 100),
          restockedValuePaise: Math.round(parseFloat(form.restockedAmount || '0') * 100),
          reason: form.reason,
          notes: form.notes,
          lineBreakdown: [],
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-ivory border border-mitti/30 p-6 rounded">
      <h3 className="font-display text-xl text-kohl mb-4">Record a return</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="ORDER NUMBER *" value={form.orderNumber} onChange={v => setForm({ ...form, orderNumber: v })} placeholder="e.g. NJ-2025-001" />
        <Field label="REASON" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="size, defect, etc." />
        <Field label="RETURNED ON *" type="date" value={form.returnedOn} onChange={v => setForm({ ...form, returnedOn: v })} />
        <Field label="REFUNDED ON" type="date" value={form.refundedOn} onChange={v => setForm({ ...form, refundedOn: v })} />
        <Field label="REFUNDED AMOUNT (₹) *" type="number" value={form.refundedAmount} onChange={v => setForm({ ...form, refundedAmount: v })} />
        <Field label="REVERSE SHIPPING (₹)" type="number" value={form.reverseShippingAmount} onChange={v => setForm({ ...form, reverseShippingAmount: v })} />
        <Field label="DAMAGED VALUE (₹)" type="number" value={form.damagedAmount} onChange={v => setForm({ ...form, damagedAmount: v })} hint="written off" />
        <Field label="RESTOCKED VALUE (₹)" type="number" value={form.restockedAmount} onChange={v => setForm({ ...form, restockedAmount: v })} hint="back into COGS" />
      </div>
      <div className="mt-4">
        <p className="label text-banarasi mb-1">NOTES</p>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
          className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
      </div>
      {err && <div className="mt-3 bg-madder/10 border border-madder p-3 text-sm text-madder">{err}</div>}
      <button onClick={submit} disabled={saving}
        className="mt-5 bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
        {saving ? 'SAVING…' : 'SAVE RETURN'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; hint?: string }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label} {hint && <span className="text-mitti font-normal">— {hint}</span>}</p>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
    </div>
  );
}
