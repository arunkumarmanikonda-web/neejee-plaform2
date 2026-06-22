'use client';
// v23.40.1 — F&F settlement detail / statement viewer.
// Provides: APPROVE, MARK PAID, attach documents, PRINT statement.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, CheckCircle2, BadgeCheck, AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/money';
import { MultiFileInput } from '@/components/admin/MultiFileInput';

export default function FnFDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [settlement, setSettlement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/admin/payroll/fnf/${id}`);
    const d = await r.json();
    setSettlement(d.settlement);
    setAttachments(d.settlement?.attachments || []);
    if (d.settlement?.paidOn) setPaidOn(new Date(d.settlement.paidOn).toISOString().slice(0, 10));
    if (d.settlement?.paymentReference) setPaymentRef(d.settlement.paymentReference);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function update(body: any) {
    setMsg(''); setBusy(true);
    try {
      const r = await fetch(`/api/admin/payroll/fnf/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setSettlement(d.settlement);
      setMsg('Saved.');
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  if (loading) return <div className="p-8">Loading…</div>;
  if (!settlement) return <div className="p-8">Settlement not found</div>;

  const employee = settlement.employee;
  const statusCls =
    settlement.status === 'PAID'      ? 'bg-green-100 text-green-800' :
    settlement.status === 'APPROVED'  ? 'bg-blue-100 text-blue-800'  :
    settlement.status === 'CANCELLED' ? 'bg-mitti/20 text-mitti'      :
                                        'bg-amber-100 text-amber-800';

  return (
    <div className="p-8 max-w-5xl mx-auto print:p-0 print:max-w-none">
      <div className="print:hidden">
        <Link href={`/admin/payroll/employees/${employee.id}`}
          className="text-xs text-mitti hover:text-madder flex items-center gap-1 mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to employee
        </Link>
      </div>

      {/* Statement header — print-friendly */}
      <div className="bg-white border border-mitti/20 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl text-kohl">Full &amp; Final Settlement</h1>
            <p className="text-mitti text-sm mt-1">Statement #{settlement.id}</p>
            <p className="text-mitti text-xs mt-0.5">Generated on {new Date(settlement.createdAt).toLocaleDateString('en-IN')}</p>
          </div>
          <span className={`text-xs uppercase px-3 py-1 ${statusCls}`}>{settlement.status}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
          <div className="bg-beige/50 p-3">
            <p className="text-[10px] uppercase tracking-widest text-mitti">Employee</p>
            <p className="text-kohl font-medium text-lg">{employee.firstName} {employee.lastName}</p>
            <p className="text-mitti text-xs">{employee.employeeCode} · {employee.designation || '—'} · {employee.department || '—'}</p>
            <p className="text-mitti text-xs">PAN: {employee.pan || '—'}</p>
            <p className="text-mitti text-xs">A/c: {employee.bankAccountNumber || '—'} · IFSC: {employee.bankIfsc || '—'}</p>
          </div>
          <div className="bg-beige/50 p-3">
            <p className="text-[10px] uppercase tracking-widest text-mitti">Exit details</p>
            <p className="text-kohl text-xs">Joined: <span className="float-right">{new Date(employee.joiningDate).toLocaleDateString('en-IN')}</span></p>
            {settlement.resignationDate && <p className="text-kohl text-xs">Resigned: <span className="float-right">{new Date(settlement.resignationDate).toLocaleDateString('en-IN')}</span></p>}
            <p className="text-kohl text-xs">Last working day: <span className="float-right">{new Date(settlement.lastWorkingDay).toLocaleDateString('en-IN')}</span></p>
            <p className="text-kohl text-xs">Notice period: <span className="float-right">{settlement.noticePeriodDays} days</span></p>
            {settlement.noticeShortfallDays > 0 && <p className="text-madder text-xs">Notice shortfall: <span className="float-right">{settlement.noticeShortfallDays} days</span></p>}
            {settlement.exitReason && <p className="text-kohl text-xs">Reason: <span className="float-right">{settlement.exitReason}</span></p>}
          </div>
        </div>

        {/* Earnings */}
        <h2 className="label text-banarasi mb-2">Earnings</h2>
        <table className="w-full text-sm border border-mitti/10 mb-4">
          <tbody>
            <StatementRow label={`Pending salary (${settlement.pendingDaysWorked} day(s) of final month)`} amount={settlement.pendingSalaryPaise} />
            <StatementRow label={`Leave encashment (${settlement.leaveBalanceDays} day(s))`} amount={settlement.leaveEncashmentPaise} />
            <StatementRow label="Bonus due" amount={settlement.bonusDuePaise} />
            <StatementRow label="Incentive due" amount={settlement.incentiveDuePaise} />
            <StatementRow label="Reimbursement due" amount={settlement.reimbursementDuePaise} />
            <StatementRow label={`Gratuity${settlement.gratuityEligible ? ' (eligible)' : ' (ineligible)'}`} amount={settlement.gratuityPaise} />
            <tr className="border-t border-mitti/20 font-medium bg-beige/40">
              <td className="p-2">TOTAL EARNINGS</td>
              <td className="p-2 text-right tabular-nums text-kohl">{formatINR(settlement.totalEarningsPaise)}</td>
            </tr>
          </tbody>
        </table>

        {/* Deductions */}
        <h2 className="label text-banarasi mb-2">Deductions / Recoveries</h2>
        <table className="w-full text-sm border border-mitti/10 mb-4">
          <tbody>
            <StatementRow label={`Notice shortfall recovery (${settlement.noticeShortfallDays} day(s))`} amount={settlement.noticeRecoveryPaise} />
            <StatementRow label="Loan recovery" amount={settlement.loanRecoveryPaise} />
            <StatementRow label="Advance recovery" amount={settlement.advanceRecoveryPaise} />
            <StatementRow label="Other recovery / fines" amount={settlement.otherRecoveryPaise} />
            <StatementRow label="TDS on F&F" amount={settlement.tdsPaise} />
            <StatementRow label="PF (final month, employee)" amount={settlement.pfFinalPaise} />
            <StatementRow label="ESI (final month, employee)" amount={settlement.esiFinalPaise} />
            <tr className="border-t border-mitti/20 font-medium bg-beige/40">
              <td className="p-2">TOTAL DEDUCTIONS</td>
              <td className="p-2 text-right tabular-nums text-madder">{formatINR(settlement.totalDeductionsPaise)}</td>
            </tr>
          </tbody>
        </table>

        {/* Net */}
        <div className={`mt-4 p-4 ${settlement.netPayablePaise >= 0 ? 'bg-green-50 border border-green-200' : 'bg-madder/10 border border-madder/30'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-mitti">Net F&amp;F payable</p>
              <p className={`font-display text-3xl mt-1 ${settlement.netPayablePaise >= 0 ? 'text-green-800' : 'text-madder'}`}>
                {settlement.netPayablePaise >= 0
                  ? formatINR(settlement.netPayablePaise)
                  : `(${formatINR(-settlement.netPayablePaise)}) — employee owes the company`}
              </p>
            </div>
            {settlement.netPayablePaise >= 0
              ? <CheckCircle2 className="w-8 h-8 text-green-700" />
              : <AlertTriangle className="w-8 h-8 text-madder" />}
          </div>
        </div>

        {settlement.status === 'PAID' && (
          <div className="mt-4 text-sm bg-blue-50 border border-blue-200 p-3">
            <p className="text-blue-900">
              <BadgeCheck className="w-4 h-4 inline mr-1 -mt-0.5" />
              Paid on {settlement.paidOn ? new Date(settlement.paidOn).toLocaleDateString('en-IN') : '—'}
              {settlement.paymentReference && <> · Reference: {settlement.paymentReference}</>}
            </p>
          </div>
        )}

        {settlement.notes && (
          <div className="mt-4 text-xs text-mitti">
            <p className="label text-mitti mb-1">Notes</p>
            <p className="whitespace-pre-wrap">{settlement.notes}</p>
          </div>
        )}

        {/* Sign-off block (print) */}
        <div className="mt-12 grid grid-cols-2 gap-12 text-xs text-mitti print:block hidden">
          <div>
            <div className="border-t border-mitti/40 pt-1">Employee signature</div>
            <p className="mt-1">{employee.firstName} {employee.lastName}</p>
          </div>
          <div>
            <div className="border-t border-mitti/40 pt-1">Authorised signatory</div>
            <p className="mt-1">For NEEJEE</p>
          </div>
        </div>
      </div>

      {/* Actions panel (hidden in print) */}
      <div className="mt-6 print:hidden">
        <div className="bg-white border border-mitti/10 p-5">
          <h3 className="font-display text-xl text-kohl mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory">
              <Printer className="w-3 h-3" /> PRINT STATEMENT
            </button>
            {settlement.status === 'DRAFT' && (
              <button onClick={() => update({ status: 'APPROVED' })} disabled={busy}
                className="px-3 py-2 bg-banarasi text-ivory text-xs tracking-widest hover:bg-banarasi/80 disabled:opacity-50">
                APPROVE
              </button>
            )}
            {settlement.status === 'APPROVED' && (
              <div className="flex items-center gap-2">
                <input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)}
                  className="border border-mitti/30 px-2 py-1.5 bg-ivory text-xs" />
                <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                  placeholder="Payment reference / UTR"
                  className="border border-mitti/30 px-2 py-1.5 bg-ivory text-xs" />
                <button onClick={() => update({ status: 'PAID', paidOn, paymentReference: paymentRef })} disabled={busy}
                  className="px-3 py-2 bg-green-700 text-ivory text-xs tracking-widest hover:bg-green-800 disabled:opacity-50">
                  MARK AS PAID
                </button>
              </div>
            )}
            {settlement.status !== 'CANCELLED' && settlement.status !== 'PAID' && (
              <button onClick={() => { if (confirm('Cancel this F&F settlement?')) update({ status: 'CANCELLED' }); }} disabled={busy}
                className="px-3 py-2 border border-madder text-madder text-xs tracking-widest hover:bg-madder hover:text-ivory disabled:opacity-50">
                CANCEL
              </button>
            )}
          </div>
          {msg && <p className="text-xs text-mitti mt-3">{msg}</p>}
        </div>

        <div className="bg-white border border-mitti/10 p-5 mt-4">
          <h3 className="font-display text-xl text-kohl mb-3">Supporting documents</h3>
          <p className="text-xs text-mitti mb-3">Handover sheet, no-dues, asset return form, signed F&amp;F acknowledgement.</p>
          <MultiFileInput
            value={attachments}
            onChange={(urls) => { setAttachments(urls); update({ attachments: urls }); }}
            folder="payroll-fnf"
            label="ATTACHMENTS"
            helpText="PDF / image — multiple files allowed"
            maxFiles={10}
          />
        </div>
      </div>
    </div>
  );
}

function StatementRow({ label, amount }: { label: string; amount: number }) {
  return (
    <tr className="border-t border-mitti/10">
      <td className="p-2 text-mitti">{label}</td>
      <td className="p-2 text-right tabular-nums text-kohl">{amount ? formatINR(amount) : '—'}</td>
    </tr>
  );
}
