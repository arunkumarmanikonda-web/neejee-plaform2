'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft, X } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface Structure {
  id: string;
  name: string;
  description?: string;
  basicPaise: number;
  hraPaise: number;
  conveyancePaise: number;
  medicalPaise: number;
  specialAllowancePaise: number;
  ltaMonthlyPaise: number;
  performanceBonusPaise: number;
  monthlyCtcPaise: number;
  active: boolean;
}

export default function StructuresPage() {
  const [list, setList] = useState<Structure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/payroll/structures');
    const d = await r.json();
    setList(d.structures || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/payroll" className="text-xs text-mitti hover:text-madder flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Back to payroll
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Salary structures</h1>
          <p className="text-mitti text-sm mt-1">Reusable templates for monthly CTC breakdown.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1 px-3 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
          <Plus className="w-3 h-3" /> NEW STRUCTURE
        </button>
      </div>

      {showNew && <NewStructureForm onSaved={() => { setShowNew(false); load(); }} onClose={() => setShowNew(false)} />}

      {loading ? <p className="text-mitti">Loading…</p> : list.length === 0 ? (
        <p className="text-mitti italic">No structures yet. Create one to start running payroll.</p>
      ) : (
        <div className="grid gap-3">
          {list.map(s => (
            <div key={s.id} className="bg-white border border-mitti/10 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-lg text-kohl">{s.name}</h3>
                  {s.description && <p className="text-xs text-mitti">{s.description}</p>}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-display text-kohl">{formatINR(s.monthlyCtcPaise)}</p>
                  <p className="text-[10px] text-mitti uppercase">Monthly CTC</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Cell label="Basic" v={s.basicPaise} />
                <Cell label="HRA" v={s.hraPaise} />
                <Cell label="Conveyance" v={s.conveyancePaise} />
                <Cell label="Medical" v={s.medicalPaise} />
                <Cell label="Special allowance" v={s.specialAllowancePaise} />
                <Cell label="LTA" v={s.ltaMonthlyPaise} />
                <Cell label="Bonus baseline" v={s.performanceBonusPaise} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Cell({ label, v }: { label: string; v: number }) {
  return (
    <div className="bg-beige p-2">
      <p className="text-[10px] uppercase text-mitti">{label}</p>
      <p className="text-kohl tabular-nums">{formatINR(v)}</p>
    </div>
  );
}

function NewStructureForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', description: '',
    basicRupees: '', hraRupees: '', conveyanceRupees: '', medicalRupees: '',
    specialAllowanceRupees: '', ltaRupees: '', bonusRupees: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const total = Object.entries(form)
    .filter(([k]) => k.endsWith('Rupees'))
    .reduce((sum, [, v]) => sum + (parseFloat(String(v)) || 0), 0);

  async function submit() {
    setErr(''); setSaving(true);
    try {
      if (!form.name) throw new Error('Name is required');
      const toPaise = (v: string) => Math.round((parseFloat(v) || 0) * 100);
      const r = await fetch('/api/admin/payroll/structures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          basicPaise: toPaise(form.basicRupees),
          hraPaise: toPaise(form.hraRupees),
          conveyancePaise: toPaise(form.conveyanceRupees),
          medicalPaise: toPaise(form.medicalRupees),
          specialAllowancePaise: toPaise(form.specialAllowanceRupees),
          ltaMonthlyPaise: toPaise(form.ltaRupees),
          performanceBonusPaise: toPaise(form.bonusRupees),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-ivory max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-kohl">New salary structure</h3>
          <button onClick={onClose} className="text-mitti hover:text-madder"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="label text-banarasi mb-1">NAME *</p>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Standard Operations Tier 1"
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
          <div>
            <p className="label text-banarasi mb-1">DESCRIPTION</p>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
          <Money label="BASIC ₹/MONTH" value={form.basicRupees} onChange={v => setForm({ ...form, basicRupees: v })} />
          <Money label="HRA ₹/MONTH" value={form.hraRupees} onChange={v => setForm({ ...form, hraRupees: v })} />
          <Money label="CONVEYANCE ₹/MONTH" value={form.conveyanceRupees} onChange={v => setForm({ ...form, conveyanceRupees: v })} />
          <Money label="MEDICAL ₹/MONTH" value={form.medicalRupees} onChange={v => setForm({ ...form, medicalRupees: v })} />
          <Money label="SPECIAL ALLOWANCE ₹/MONTH" value={form.specialAllowanceRupees} onChange={v => setForm({ ...form, specialAllowanceRupees: v })} />
          <Money label="LTA ₹/MONTH (avg)" value={form.ltaRupees} onChange={v => setForm({ ...form, ltaRupees: v })} />
          <Money label="PERF BONUS BASELINE ₹/MONTH" value={form.bonusRupees} onChange={v => setForm({ ...form, bonusRupees: v })} />
        </div>

        <div className="mt-4 bg-beige p-3 flex justify-between">
          <span className="text-mitti text-xs uppercase">Total monthly CTC</span>
          <span className="font-display text-xl text-kohl">{formatINR(Math.round(total * 100))}</span>
        </div>

        {err && <p className="mt-3 text-madder text-xs">{err}</p>}

        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'CREATING…' : 'CREATE STRUCTURE'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type="number" value={value} onChange={e => onChange(e.target.value)} placeholder="0"
        className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm tabular-nums" />
    </div>
  );
}
