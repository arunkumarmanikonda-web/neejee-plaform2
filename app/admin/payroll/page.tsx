'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Users, Layers, Calendar, Settings, ChevronRight, RefreshCw } from 'lucide-react';
import { formatINR } from '@/lib/money';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface Run {
  id: string;
  month: number;
  year: number;
  label: string;
  status: string;
  totalGrossPaise: number;
  totalNetPaise: number;
  employeeCount: number;
  paidAt?: string | null;
}

export default function PayrollIndexPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [empCount, setEmpCount] = useState(0);
  const [structCount, setStructCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      fetch('/api/admin/payroll/runs').then(r => r.json()),
      fetch('/api/admin/payroll/employees').then(r => r.json()),
      fetch('/api/admin/payroll/structures').then(r => r.json()),
    ]);
    setRuns(r1.runs || []);
    setEmpCount((r2.employees || []).filter((e: any) => e.status === 'ACTIVE').length);
    setStructCount((r3.structures || []).filter((s: any) => s.active).length);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="font-display text-3xl text-kohl mb-1">Payroll</h1>
      <p className="text-mitti text-sm mb-6">Employee onboarding, salary structures, monthly payroll runs.</p>

      {/* Sub-section cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
        <Link href="/admin/payroll/employees" className="bg-beige p-5 hover:bg-madder/5 group">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-madder" />
            <ChevronRight className="w-4 h-4 text-mitti group-hover:text-madder" />
          </div>
          <p className="text-2xl font-display text-kohl">{empCount}</p>
          <p className="text-xs text-mitti">Active employees</p>
        </Link>
        <Link href="/admin/payroll/structures" className="bg-beige p-5 hover:bg-madder/5 group">
          <div className="flex items-center justify-between mb-2">
            <Layers className="w-5 h-5 text-madder" />
            <ChevronRight className="w-4 h-4 text-mitti group-hover:text-madder" />
          </div>
          <p className="text-2xl font-display text-kohl">{structCount}</p>
          <p className="text-xs text-mitti">Salary structures</p>
        </Link>
        <Link href="/admin/payroll/attendance" className="bg-beige p-5 hover:bg-madder/5 group">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-5 h-5 text-madder" />
            <ChevronRight className="w-4 h-4 text-mitti group-hover:text-madder" />
          </div>
          <p className="text-2xl font-display text-kohl">—</p>
          <p className="text-xs text-mitti">Attendance &amp; adjustments</p>
        </Link>
        <Link href="/admin/payroll/config" className="bg-beige p-5 hover:bg-madder/5 group">
          <div className="flex items-center justify-between mb-2">
            <Settings className="w-5 h-5 text-madder" />
            <ChevronRight className="w-4 h-4 text-mitti group-hover:text-madder" />
          </div>
          <p className="text-2xl font-display text-kohl">—</p>
          <p className="text-xs text-mitti">Configuration (PF/ESI/TDS)</p>
        </Link>
      </div>

      {/* Runs */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-2xl text-kohl">Monthly payroll runs</h2>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1 px-3 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
          <Plus className="w-3 h-3" /> NEW RUN
        </button>
      </div>

      {showNew && <NewRunForm onSaved={() => { setShowNew(false); load(); }} onClose={() => setShowNew(false)} />}

      {loading ? <p className="text-mitti">Loading…</p> :
       runs.length === 0 ? (
        <div className="bg-beige p-12 text-center">
          <RefreshCw className="w-12 h-12 text-mitti/40 mx-auto mb-3" />
          <p className="text-mitti">No payroll runs yet.</p>
          <p className="text-mitti text-xs mt-2">Click "NEW RUN" to create one for the current month.</p>
        </div>
      ) : (
        <table className="w-full bg-white border border-mitti/10 text-sm">
          <thead className="bg-beige text-mitti text-xs uppercase tracking-wider">
            <tr>
              <th className="p-3 text-left">Period</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Employees</th>
              <th className="p-3 text-right">Gross</th>
              <th className="p-3 text-right">Net</th>
              <th className="p-3 text-right">Paid</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <tr key={r.id} className="border-t border-mitti/10 hover:bg-beige/30">
                <td className="p-3 text-kohl font-medium">{r.label}</td>
                <td className="p-3 text-center"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-right tabular-nums text-mitti">{r.employeeCount || '—'}</td>
                <td className="p-3 text-right tabular-nums text-kohl">{r.totalGrossPaise ? formatINR(r.totalGrossPaise) : '—'}</td>
                <td className="p-3 text-right tabular-nums text-kohl">{r.totalNetPaise ? formatINR(r.totalNetPaise) : '—'}</td>
                <td className="p-3 text-right text-xs text-mitti">{r.paidAt ? new Date(r.paidAt).toLocaleDateString('en-IN') : '—'}</td>
                <td className="p-3 text-right">
                  <Link href={`/admin/payroll/runs/${r.id}`} className="text-xs text-madder hover:underline">OPEN →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewRunForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setSaving(true);
    try {
      const r = await fetch('/api/admin/payroll/runs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year, notes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4">
      <div className="bg-ivory max-w-md w-full p-6">
        <h3 className="font-display text-xl text-kohl mb-4">New payroll run</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="label text-banarasi mb-1">MONTH</p>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <p className="label text-banarasi mb-1">YEAR</p>
            <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
        </div>
        <div className="mt-3">
          <p className="label text-banarasi mb-1">NOTES</p>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
        </div>
        {err && <p className="mt-3 text-madder text-xs">{err}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'CREATING…' : 'CREATE'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-mitti/20 text-kohl',
    COMPUTED: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-banarasi/20 text-banarasi',
    PAID: 'bg-green-100 text-green-800',
    LOCKED: 'bg-kohl text-ivory',
  };
  return <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[status] || ''}`}>{status}</span>;
}
