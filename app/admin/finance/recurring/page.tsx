'use client';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/money';
import { Plus, Loader2, Play, Pause, Trash2 } from 'lucide-react';

export default function RecurringPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tR, cR] = await Promise.all([
      fetch('/api/admin/finance/recurring'),
      fetch('/api/admin/finance/categories'),
    ]);
    const tJ = await tR.json();
    const cJ = await cR.json();
    setRows(tJ.templates || []);
    setCats((cJ.categories || []).filter((c: any) => c.isActive));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (id: string, active: boolean) => {
    await fetch(`/api/admin/finance/recurring/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    });
    load();
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this template? Future bills will no longer be auto-created.')) return;
    await fetch(`/api/admin/finance/recurring/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="font-display text-2xl text-kohl">Recurring Expenses</h2>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest">
          <Plus className="w-3 h-3" /> {showNew ? 'CLOSE' : 'NEW TEMPLATE'}
        </button>
      </div>
      <p className="text-sm text-mitti">
        Templates create a Bill automatically on their schedule (cron runs daily). Bills then need payment to hit the P&L.
      </p>

      {showNew && <NewTemplateForm categories={cats} onSaved={() => { setShowNew(false); load(); }} />}

      {loading ? (
        <div className="text-mitti py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          No recurring templates yet. Common candidates: rent, salaries, SaaS subscriptions, GST/TDS deposits.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">NAME</th>
                <th className="text-left p-3">CATEGORY</th>
                <th className="text-right p-3">AMOUNT</th>
                <th className="text-left p-3">FREQUENCY</th>
                <th className="text-left p-3">NEXT RUN</th>
                <th className="text-center p-3">STATUS</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-mitti/10">
                  <td className="p-3 text-kohl">
                    {r.name}
                    {r.vendorNameSnapshot && <span className="text-xs text-mitti ml-2">· {r.vendorNameSnapshot}</span>}
                  </td>
                  <td className="p-3 text-mitti text-xs">{r.category?.label || '—'}</td>
                  <td className="p-3 text-right tabular-nums text-kohl">
                    {formatINR(r.totalPaise)}
                    {r.gstPaise > 0 && <div className="text-[10px] text-mitti">incl GST {formatINR(r.gstPaise)}</div>}
                  </td>
                  <td className="p-3 text-mitti text-xs">
                    {r.frequency.toLowerCase()}{r.dayOfMonth ? ` (day ${r.dayOfMonth})` : ''}
                  </td>
                  <td className="p-3 text-mitti text-xs">{new Date(r.nextRunDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded ${
                      r.active ? 'bg-emerald-100 text-emerald-800' : 'bg-mitti/10 text-mitti'
                    }`}>{r.active ? 'ACTIVE' : 'PAUSED'}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => toggle(r.id, r.active)}
                        className="p-1.5 hover:bg-beige rounded" title={r.active ? 'Pause' : 'Resume'}>
                        {r.active ? <Pause className="w-3 h-3 text-mitti" /> : <Play className="w-3 h-3 text-emerald-700" />}
                      </button>
                      <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-madder/10 rounded">
                        <Trash2 className="w-3 h-3 text-madder" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewTemplateForm({ categories, onSaved }: { categories: any[]; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: '', categoryId: '', vendorNameSnapshot: '',
    amountRupees: '', gstRupees: '',
    frequency: 'MONTHLY', dayOfMonth: '1', dueOffsetDays: '15',
    firstRunDate: today,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      if (!form.name || !form.categoryId || !form.amountRupees) throw new Error('Name, category and amount required');
      const r = await fetch('/api/admin/finance/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amountPaise: Math.round(parseFloat(form.amountRupees) * 100),
          gstPaise: Math.round(parseFloat(form.gstRupees || '0') * 100),
          dayOfMonth: form.frequency === 'WEEKLY' ? null : parseInt(form.dayOfMonth),
          dueOffsetDays: parseInt(form.dueOffsetDays),
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
      <h3 className="font-display text-xl text-kohl mb-4">New recurring template</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="NAME *" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Mumbai office rent" />
        <div>
          <p className="label text-banarasi mb-1">CATEGORY *</p>
          <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory">
            <option value="">Choose…</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <Field label="VENDOR / PAYEE" value={form.vendorNameSnapshot} onChange={v => setForm({ ...form, vendorNameSnapshot: v })} />
        <Field label="AMOUNT (₹) *" type="number" value={form.amountRupees} onChange={v => setForm({ ...form, amountRupees: v })} />
        <Field label="GST (₹)" type="number" value={form.gstRupees} onChange={v => setForm({ ...form, gstRupees: v })} />
        <div>
          <p className="label text-banarasi mb-1">FREQUENCY</p>
          <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory">
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
          </select>
        </div>
        {form.frequency !== 'WEEKLY' && (
          <Field label="DAY OF MONTH (1-28)" type="number" value={form.dayOfMonth} onChange={v => setForm({ ...form, dayOfMonth: v })} />
        )}
        <Field label="DUE OFFSET (days after creation)" type="number" value={form.dueOffsetDays} onChange={v => setForm({ ...form, dueOffsetDays: v })} />
        <Field label="FIRST RUN DATE" type="date" value={form.firstRunDate} onChange={v => setForm({ ...form, firstRunDate: v })} />
      </div>
      {err && <div className="mt-3 bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}
      <button onClick={submit} disabled={saving}
        className="mt-4 bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
        {saving ? 'CREATING…' : 'CREATE TEMPLATE'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
    </div>
  );
}
