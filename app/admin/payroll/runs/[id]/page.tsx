'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, CheckCircle2, Banknote, Download, RotateCw } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/admin/payroll/runs/${runId}`);
    const d = await r.json();
    setRun(d.run);
    setLoading(false);
  }
  useEffect(() => { load(); }, [runId]);

  async function act(action: string) {
    setWorking(true); setMsg('');
    try {
      const r = await fetch(`/api/admin/payroll/runs/${runId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      if (d.summary) setMsg(`✓ ${d.summary.computed} payslips computed (${d.summary.skipped} skipped)`);
      await load();
    } catch (e: any) { setMsg(`✗ ${e.message}`); } finally { setWorking(false); }
  }

  function downloadCsv() {
    if (!run?.payslips) return;
    const headers = ['Code','Name','Designation','Department','Days worked','Gross','PF','ESI','TDS','PT','Other ded.','Total ded.','Net'];
    const rows = run.payslips.map((p: any) => [
      p.employee.employeeCode,
      `${p.employee.firstName} ${p.employee.lastName || ''}`.trim(),
      p.employee.designation || '',
      p.employee.department || '',
      `${p.daysWorked}/${p.daysInMonth}`,
      (p.grossPaise / 100).toFixed(2),
      (p.pfEmployeePaise / 100).toFixed(2),
      (p.esiEmployeePaise / 100).toFixed(2),
      (p.tdsPaise / 100).toFixed(2),
      (p.professionalTaxPaise / 100).toFixed(2),
      ((p.advanceRecoveryPaise + p.loanRepaymentPaise + p.finesPaise + p.otherDeductionsPaise) / 100).toFixed(2),
      (p.totalDeductionsPaise / 100).toFixed(2),
      (p.netPaise / 100).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${run.label.replace(' ', '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-8">Loading…</div>;
  if (!run) return <div className="p-8">Run not found</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/payroll" className="text-xs text-mitti hover:text-madder flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Back to payroll
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">{run.label}</h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-mitti">
            <span>Status: <strong className="text-kohl">{run.status}</strong></span>
            {run.computedAt && <span>· Computed {new Date(run.computedAt).toLocaleString('en-IN')}</span>}
            {run.approvedAt && <span>· Approved {new Date(run.approvedAt).toLocaleString('en-IN')}</span>}
            {run.paidAt && <span>· Paid {new Date(run.paidAt).toLocaleString('en-IN')}</span>}
          </div>
        </div>

        <div className="flex gap-2">
          {(run.status === 'DRAFT' || run.status === 'COMPUTED') && (
            <button onClick={() => act('COMPUTE')} disabled={working}
              className="flex items-center gap-1 px-3 py-2 bg-kohl text-ivory text-xs tracking-widest disabled:opacity-50">
              <Play className="w-3 h-3" /> {run.status === 'COMPUTED' ? 'RECOMPUTE' : 'COMPUTE'}
            </button>
          )}
          {run.status === 'COMPUTED' && (
            <button onClick={() => act('APPROVE')} disabled={working}
              className="flex items-center gap-1 px-3 py-2 bg-banarasi text-ivory text-xs tracking-widest disabled:opacity-50">
              <CheckCircle2 className="w-3 h-3" /> APPROVE
            </button>
          )}
          {run.status === 'APPROVED' && (
            <button onClick={() => act('MARK_PAID')} disabled={working}
              className="flex items-center gap-1 px-3 py-2 bg-green-700 text-ivory text-xs tracking-widest disabled:opacity-50">
              <Banknote className="w-3 h-3" /> MARK PAID
            </button>
          )}
          {(run.status === 'COMPUTED' || run.status === 'APPROVED') && (
            <button onClick={() => act('REOPEN')} disabled={working}
              className="flex items-center gap-1 px-3 py-2 border border-mitti/30 text-mitti text-xs tracking-widest disabled:opacity-50">
              <RotateCw className="w-3 h-3" /> REOPEN
            </button>
          )}
          <button onClick={downloadCsv}
            className="flex items-center gap-1 px-3 py-2 border border-mitti/30 text-kohl text-xs tracking-widest">
            <Download className="w-3 h-3" /> CSV
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 p-3 text-sm ${msg.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {msg}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Card label="EMPLOYEES" value={String(run.employeeCount)} />
        <Card label="GROSS" value={formatINR(run.totalGrossPaise)} />
        <Card label="DEDUCTIONS" value={formatINR(run.totalDeductionsPaise)} />
        <Card label="NET PAYOUT" value={formatINR(run.totalNetPaise)} highlight />
      </div>

      {/* Payslips */}
      {run.payslips?.length === 0 ? (
        <div className="bg-beige p-8 text-center">
          <p className="text-mitti">No payslips yet. Click COMPUTE to generate them for all active employees with salary structures.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-mitti/10">
            <thead className="bg-beige text-mitti text-[10px] uppercase tracking-wider">
              <tr>
                <th className="p-2 text-left">Code</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-center">Days</th>
                <th className="p-2 text-right">Gross</th>
                <th className="p-2 text-right">PF</th>
                <th className="p-2 text-right">ESI</th>
                <th className="p-2 text-right">TDS</th>
                <th className="p-2 text-right">PT</th>
                <th className="p-2 text-right">Other ded.</th>
                <th className="p-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {run.payslips?.map((p: any) => (
                <tr key={p.id} className="border-t border-mitti/10 hover:bg-beige/30">
                  <td className="p-2 text-mitti font-mono text-xs">{p.employee.employeeCode}</td>
                  <td className="p-2 text-kohl">
                    {p.employee.firstName} {p.employee.lastName}
                    {p.employee.designation && <span className="block text-[10px] text-mitti">{p.employee.designation}</span>}
                  </td>
                  <td className="p-2 text-center text-mitti text-xs">{p.daysWorked}/{p.daysInMonth}</td>
                  <td className="p-2 text-right tabular-nums">{formatINR(p.grossPaise)}</td>
                  <td className="p-2 text-right tabular-nums text-mitti">{p.pfEmployeePaise ? formatINR(p.pfEmployeePaise) : '—'}</td>
                  <td className="p-2 text-right tabular-nums text-mitti">{p.esiEmployeePaise ? formatINR(p.esiEmployeePaise) : '—'}</td>
                  <td className="p-2 text-right tabular-nums text-mitti">{p.tdsPaise ? formatINR(p.tdsPaise) : '—'}</td>
                  <td className="p-2 text-right tabular-nums text-mitti">{p.professionalTaxPaise ? formatINR(p.professionalTaxPaise) : '—'}</td>
                  <td className="p-2 text-right tabular-nums text-madder">
                    {formatINR(p.advanceRecoveryPaise + p.loanRepaymentPaise + p.finesPaise + p.otherDeductionsPaise)}
                  </td>
                  <td className="p-2 text-right tabular-nums font-medium text-kohl">{formatINR(p.netPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 ${highlight ? 'bg-madder text-ivory' : 'bg-beige'}`}>
      <p className={`text-[10px] uppercase tracking-wider ${highlight ? 'text-ivory/70' : 'text-mitti'}`}>{label}</p>
      <p className={`font-display text-2xl mt-1 ${highlight ? 'text-ivory' : 'text-kohl'}`}>{value}</p>
    </div>
  );
}
