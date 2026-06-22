'use client';
// v23.40.1 — Employee personal file with tabs: Profile, Documents, Salary, Reimbursements, Incentives, Exit / F&F.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, FileText, Wallet, Sparkles, LogOut, User,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { formatINR } from '@/lib/money';
import { MultiFileInput } from '@/components/admin/MultiFileInput';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

type Tab = 'profile' | 'documents' | 'salary' | 'reimbursements' | 'incentives' | 'exit';

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const [employee, setEmployee] = useState<any>(null);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('profile');
  const [showAssign, setShowAssign] = useState(false);
  const [showAdj, setShowAdj] = useState(false);

  async function load() {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      fetch(`/api/admin/payroll/employees/${employeeId}`).then(r => r.json()),
      fetch('/api/admin/payroll/structures').then(r => r.json()),
    ]);
    setEmployee(r1.employee);
    setStructures(r2.structures || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [employeeId]);

  if (loading) return <div className="p-8">Loading…</div>;
  if (!employee) return <div className="p-8">Employee not found</div>;

  const current = employee.salaryAssignments?.find((a: any) => !a.effectiveTo);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/payroll/employees" className="text-xs text-mitti hover:text-madder flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Back to employees
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          {employee.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={employee.photoUrl} alt={employee.firstName} className="w-16 h-16 rounded-full object-cover border border-mitti/20" />
          )}
          <div>
            <h1 className="font-display text-3xl text-kohl">{employee.firstName} {employee.lastName}</h1>
            <p className="text-mitti text-sm mt-1">
              {employee.employeeCode} · {employee.designation || '—'} · {employee.department || '—'}
            </p>
          </div>
        </div>
        <span className={`text-xs uppercase px-3 py-1 ${
          employee.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
          employee.status === 'ON_NOTICE' ? 'bg-amber-100 text-amber-800' :
          'bg-mitti/20 text-kohl'
        }`}>{employee.status.replace('_', ' ')}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-mitti/10 overflow-x-auto">
        {[
          { id: 'profile',        label: 'Profile',          icon: User },
          { id: 'documents',      label: 'Documents',        icon: FileText },
          { id: 'salary',         label: 'Salary',           icon: Wallet },
          { id: 'reimbursements', label: 'Reimbursements',   icon: Wallet },
          { id: 'incentives',     label: 'Performance pay',  icon: Sparkles },
          { id: 'exit',           label: 'Exit / F&F',       icon: LogOut },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-widest whitespace-nowrap ${
              tab === t.id ? 'border-b-2 border-madder text-kohl' : 'text-mitti hover:text-kohl'
            }`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile'        && <ProfileTab employee={employee} />}
      {tab === 'documents'      && <DocumentsTab employee={employee} onSaved={load} />}
      {tab === 'salary'         && <SalaryTab employee={employee} structures={structures} current={current} setShowAssign={setShowAssign} setShowAdj={setShowAdj} />}
      {tab === 'reimbursements' && <ReimbursementsTab employee={employee} onSaved={load} />}
      {tab === 'incentives'     && <IncentivesTab employee={employee} onSaved={load} />}
      {tab === 'exit'           && <ExitTab employee={employee} onSaved={load} />}

      {showAssign && <AssignForm employeeId={employee.id} structures={structures} onSaved={() => { setShowAssign(false); load(); }} onClose={() => setShowAssign(false)} />}
      {showAdj && <AdjustmentForm employeeId={employee.id} onSaved={() => { setShowAdj(false); load(); }} onClose={() => setShowAdj(false)} />}
    </div>
  );
}

// ───────────────────────── PROFILE ─────────────────────────
function ProfileTab({ employee }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Section title="Contact">
        <Row label="Email" value={employee.email || '—'} />
        <Row label="Phone" value={employee.phone || '—'} />
        <Row label="Emergency" value={employee.emergencyContact || '—'} />
        <Row label="Address" value={employee.address || '—'} />
      </Section>
      <Section title="KYC">
        <Row label="PAN" value={employee.pan || '—'} />
        <Row label="Aadhaar (last 4)" value={employee.aadhaarLast4 ? `••• ${employee.aadhaarLast4}` : '—'} />
        <Row label="DOB" value={employee.dob ? new Date(employee.dob).toLocaleDateString('en-IN') : '—'} />
        <Row label="UAN (PF)" value={employee.uanNumber || '—'} />
        <Row label="ESIC" value={employee.esicNumber || '—'} />
        <Row label="Tax regime" value={employee.taxRegime} />
      </Section>
      <Section title="Bank">
        <Row label="A/C name" value={employee.bankAccountName || '—'} />
        <Row label="A/C number" value={employee.bankAccountNumber || '—'} />
        <Row label="IFSC" value={employee.bankIfsc || '—'} />
      </Section>
      <Section title="Employment">
        <Row label="Joined" value={new Date(employee.joiningDate).toLocaleDateString('en-IN')} />
        <Row label="Type" value={employee.employmentType} />
        <Row label="Notice period" value={`${employee.noticePeriodDays || 30} days`} />
        {employee.resignationDate && <Row label="Resigned on" value={new Date(employee.resignationDate).toLocaleDateString('en-IN')} />}
        {employee.lastWorkingDay && <Row label="Last working day" value={new Date(employee.lastWorkingDay).toLocaleDateString('en-IN')} />}
        {employee.exitDate && <Row label="Exit date" value={new Date(employee.exitDate).toLocaleDateString('en-IN')} />}
      </Section>
    </div>
  );
}

// ───────────────────────── DOCUMENTS ─────────────────────────
function DocumentsTab({ employee, onSaved }: any) {
  const [docs, setDocs] = useState<string[]>(employee.documents || []);
  const [photoUrl, setPhotoUrl] = useState<string>(employee.photoUrl || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setMsg(''); setSaving(true);
    try {
      const r = await fetch(`/api/admin/payroll/employees/${employee.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents: docs, photoUrl: photoUrl || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      setMsg('Saved.');
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="bg-white border border-mitti/10 p-5">
      <h2 className="font-display text-xl text-kohl mb-2">Personal file</h2>
      <p className="text-xs text-mitti mb-4">
        Centralized vault for PAN copy, Aadhaar (masked), cancelled cheque, passport photo, signed offer letter,
        relieving letter from previous employer, bank passbook, educational certificates, address proof,
        and any other supporting documents.
      </p>

      <div className="mb-4">
        <label className="label text-mitti">PROFILE PHOTO URL (optional)</label>
        <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)}
          placeholder="Paste a photo URL or upload below and copy"
          className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm mt-1" />
      </div>

      <MultiFileInput
        value={docs}
        onChange={setDocs}
        folder="payroll-employees"
        label="EMPLOYEE DOCUMENTS"
        helpText="PAN, Aadhaar, cancelled cheque, photo, offer letter, certificates, etc."
        maxFiles={30}
        maxSizeMB={20}
      />

      <div className="flex items-center gap-3 mt-5">
        <button onClick={save} disabled={saving}
          className="bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
          {saving ? 'SAVING…' : 'SAVE DOCUMENTS'}
        </button>
        {msg && <span className="text-xs text-mitti">{msg}</span>}
      </div>
    </div>
  );
}

// ───────────────────────── SALARY ─────────────────────────
function SalaryTab({ employee, structures, current, setShowAssign, setShowAdj }: any) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-mitti/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl text-kohl">Salary structure</h2>
          <button onClick={() => setShowAssign(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
            <Plus className="w-3 h-3" /> {current ? 'CHANGE' : 'ASSIGN'}
          </button>
        </div>
        {current ? (
          <div className="bg-beige p-3 text-sm">
            <p className="text-kohl font-medium">{current.structure.name}</p>
            <p className="text-mitti text-xs">Effective from {new Date(current.effectiveFrom).toLocaleDateString('en-IN')}</p>
            <p className="text-2xl font-display text-kohl mt-2">{formatINR(current.structure.monthlyCtcPaise)}/mo CTC</p>
          </div>
        ) : (
          <p className="text-amber-700 text-sm italic">No salary structure assigned — employee will be skipped in payroll runs.</p>
        )}
        {employee.salaryAssignments?.length > 1 && (
          <details className="mt-3 text-xs">
            <summary className="cursor-pointer text-mitti">History ({employee.salaryAssignments.length})</summary>
            <ul className="mt-2 space-y-1">
              {employee.salaryAssignments.map((a: any) => (
                <li key={a.id} className="text-mitti">
                  {new Date(a.effectiveFrom).toLocaleDateString('en-IN')} – {a.effectiveTo ? new Date(a.effectiveTo).toLocaleDateString('en-IN') : 'current'}
                  : {a.structure.name} ({formatINR(a.structure.monthlyCtcPaise)})
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="bg-white border border-mitti/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl text-kohl">One-time adjustments</h2>
          <button onClick={() => setShowAdj(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
            <Plus className="w-3 h-3" /> ADD
          </button>
        </div>
        {employee.adjustments?.filter((a: any) => !a.appliedToPayslipId).length === 0 ? (
          <p className="text-mitti text-sm italic">None pending.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-mitti uppercase">
              <tr><th className="p-1 text-left">Period</th><th className="p-1 text-left">Kind</th><th className="p-1 text-left">Description</th><th className="p-1 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {employee.adjustments?.filter((a: any) => !a.appliedToPayslipId).map((a: any) => (
                <tr key={a.id} className="border-t border-mitti/10">
                  <td className="p-1 text-mitti">{MONTHS[a.forMonth - 1]} {a.forYear}</td>
                  <td className="p-1"><span className={`text-[10px] uppercase px-1.5 py-0.5 ${
                    ['ADVANCE','LOAN_EMI','FINE','OTHER_DEDUCTION'].includes(a.kind) ? 'bg-madder/10 text-madder' : 'bg-green-100 text-green-800'
                  }`}>{a.kind}</span></td>
                  <td className="p-1 text-kohl">{a.description}</td>
                  <td className="p-1 text-right tabular-nums">{formatINR(a.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border border-mitti/10 p-5">
        <h2 className="font-display text-xl text-kohl mb-3">Payslip history</h2>
        {employee.payslips?.length === 0 ? (
          <p className="text-mitti text-sm italic">No payslips yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-mitti uppercase">
              <tr><th className="p-1 text-left">Run</th><th className="p-1 text-right">Gross</th><th className="p-1 text-right">Ded.</th><th className="p-1 text-right">Net</th><th className="p-1 text-left">Status</th></tr>
            </thead>
            <tbody>
              {employee.payslips?.map((p: any) => (
                <tr key={p.id} className="border-t border-mitti/10">
                  <td className="p-1 text-kohl">{p.payrollRun.label}</td>
                  <td className="p-1 text-right tabular-nums">{formatINR(p.grossPaise)}</td>
                  <td className="p-1 text-right tabular-nums text-madder">{formatINR(p.totalDeductionsPaise)}</td>
                  <td className="p-1 text-right tabular-nums font-medium">{formatINR(p.netPaise)}</td>
                  <td className="p-1 text-mitti">{p.payrollRun.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── REIMBURSEMENTS ─────────────────────────
function ReimbursementsTab({ employee, onSaved }: any) {
  const p = employee.reimbursementPolicy;
  const [form, setForm] = useState({
    mobile:     p ? p.mobileCapPaise     / 100 : 0,
    conveyance: p ? p.conveyanceCapPaise / 100 : 0,
    internet:   p ? p.internetCapPaise   / 100 : 0,
    food:       p ? p.foodCapPaise       / 100 : 0,
    fuel:       p ? p.fuelCapPaise       / 100 : 0,
    book:       p ? p.bookCapPaise       / 100 : 0,
    other:      p ? p.otherCapPaise      / 100 : 0,
    autoAddToPayroll: p ? p.autoAddToPayroll : true,
    notes: p?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setMsg(''); setSaving(true);
    try {
      const r = await fetch(`/api/admin/payroll/employees/${employee.id}/reimbursement`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobileCapPaise:     Math.round(Number(form.mobile)     * 100),
          conveyanceCapPaise: Math.round(Number(form.conveyance) * 100),
          internetCapPaise:   Math.round(Number(form.internet)   * 100),
          foodCapPaise:       Math.round(Number(form.food)       * 100),
          fuelCapPaise:       Math.round(Number(form.fuel)       * 100),
          bookCapPaise:       Math.round(Number(form.book)       * 100),
          otherCapPaise:      Math.round(Number(form.other)      * 100),
          autoAddToPayroll:   !!form.autoAddToPayroll,
          notes: form.notes,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      setMsg('Saved.');
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  }

  const total = ['mobile','conveyance','internet','food','fuel','book','other']
    .reduce((s, k) => s + Number((form as any)[k] || 0), 0);

  return (
    <div className="bg-white border border-mitti/10 p-5">
      <h2 className="font-display text-xl text-kohl mb-2">Reimbursement caps (monthly)</h2>
      <p className="text-xs text-mitti mb-4">
        Set the monthly ceiling for each reimbursement head. Employee submits claims via Adjustments and the
        payroll engine caps them at these limits. If <b>Auto-add to payroll</b> is on, the full cap is added every
        month even without explicit claims (useful for fixed allowances).
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RupeeField label="MOBILE / TELECOM (₹/mo)"  value={form.mobile}     onChange={v => setForm({ ...form, mobile: v })} />
        <RupeeField label="CONVEYANCE (₹/mo)"        value={form.conveyance} onChange={v => setForm({ ...form, conveyance: v })} />
        <RupeeField label="INTERNET / BROADBAND (₹/mo)" value={form.internet} onChange={v => setForm({ ...form, internet: v })} />
        <RupeeField label="MEAL / FOOD COUPONS (₹/mo)"  value={form.food}     onChange={v => setForm({ ...form, food: v })} />
        <RupeeField label="FUEL (₹/mo)"              value={form.fuel}     onChange={v => setForm({ ...form, fuel: v })} />
        <RupeeField label="BOOKS / PERIODICALS (₹/mo)" value={form.book}     onChange={v => setForm({ ...form, book: v })} />
        <RupeeField label="OTHER (₹/mo)"             value={form.other}    onChange={v => setForm({ ...form, other: v })} />
      </div>

      <label className="flex items-center gap-2 text-sm mt-4">
        <input type="checkbox" checked={form.autoAddToPayroll}
          onChange={e => setForm({ ...form, autoAddToPayroll: e.target.checked })} />
        <span>Auto-add full caps to monthly payroll (treat as fixed allowance)</span>
      </label>

      <div className="mt-3">
        <p className="label text-banarasi mb-1">NOTES</p>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
          className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
      </div>

      <div className="mt-5 flex items-center gap-3 bg-beige p-3">
        <span className="text-xs uppercase text-mitti">Total monthly reimbursement cap</span>
        <span className="font-display text-xl text-kohl ml-auto">₹{total.toLocaleString('en-IN')}</span>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={save} disabled={saving}
          className="bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
          {saving ? 'SAVING…' : 'SAVE POLICY'}
        </button>
        {msg && <span className="text-xs text-mitti">{msg}</span>}
      </div>
    </div>
  );
}

// ───────────────────────── INCENTIVES ─────────────────────────
function IncentivesTab({ employee, onSaved }: any) {
  const p = employee.incentivePlan;
  const [form, setForm] = useState({
    planType:           p?.planType           || 'FIXED',
    fixedIncentive:     p ? p.fixedIncentivePaise / 100 : 0,
    variableBase:       p ? p.variableBasePaise   / 100 : 0,
    variableMax:        p ? p.variableMaxPaise    / 100 : 0,
    quarterlyBonus:     p ? p.quarterlyBonusPaise / 100 : 0,
    annualBonus:        p ? p.annualBonusPaise    / 100 : 0,
    payoutFrequency:    p?.payoutFrequency    || 'MONTHLY',
    metric:             p?.metric             || '',
    notes:              p?.notes              || '',
    active:             p ? p.active : true,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function save() {
    setMsg(''); setSaving(true);
    try {
      const r = await fetch(`/api/admin/payroll/employees/${employee.id}/incentive`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planType:            form.planType,
          fixedIncentivePaise: Math.round(Number(form.fixedIncentive) * 100),
          variableBasePaise:   Math.round(Number(form.variableBase)   * 100),
          variableMaxPaise:    Math.round(Number(form.variableMax)    * 100),
          quarterlyBonusPaise: Math.round(Number(form.quarterlyBonus) * 100),
          annualBonusPaise:    Math.round(Number(form.annualBonus)    * 100),
          payoutFrequency:     form.payoutFrequency,
          metric:              form.metric,
          notes:               form.notes,
          active:              !!form.active,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      setMsg('Saved.');
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="bg-white border border-mitti/10 p-5">
      <h2 className="font-display text-xl text-kohl mb-2">Performance pay / incentive plan</h2>
      <p className="text-xs text-mitti mb-4">
        Configure incentives, bonuses, and variable pay. Actual achievement is captured each month via the
        Adjustments table (kind = INCENTIVE / BONUS). Use this section to define the policy and ceilings.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <p className="label text-banarasi mb-1">PLAN TYPE</p>
          <select value={form.planType} onChange={e => setForm({ ...form, planType: e.target.value })}
            className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
            <option value="FIXED">Fixed (flat monthly amount)</option>
            <option value="PERCENT_OF_TARGET">Percent of target achievement</option>
            <option value="SLAB">Slab-based</option>
            <option value="CUSTOM">Custom / discretionary</option>
          </select>
        </div>
        <div>
          <p className="label text-banarasi mb-1">PAYOUT FREQUENCY</p>
          <select value={form.payoutFrequency} onChange={e => setForm({ ...form, payoutFrequency: e.target.value })}
            className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUALLY">Annually</option>
            <option value="EVENT">Event-based (e.g., closure of deal)</option>
          </select>
        </div>

        <RupeeField label="FIXED INCENTIVE (₹/mo)"        value={form.fixedIncentive} onChange={v => setForm({ ...form, fixedIncentive: v })} />
        <RupeeField label="VARIABLE BASE (₹ @ 100% target)" value={form.variableBase}   onChange={v => setForm({ ...form, variableBase: v })} />
        <RupeeField label="VARIABLE MAX CAP (₹)"          value={form.variableMax}    onChange={v => setForm({ ...form, variableMax: v })} />
        <RupeeField label="QUARTERLY BONUS (₹)"           value={form.quarterlyBonus} onChange={v => setForm({ ...form, quarterlyBonus: v })} />
        <RupeeField label="ANNUAL BONUS / DIWALI (₹)"     value={form.annualBonus}    onChange={v => setForm({ ...form, annualBonus: v })} />

        <div className="md:col-span-2">
          <p className="label text-banarasi mb-1">TARGET METRIC (descriptive)</p>
          <input value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}
            placeholder="e.g., Monthly sales target, NPS ≥ 70, Orders shipped ≥ 500"
            className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm mt-4">
        <input type="checkbox" checked={form.active}
          onChange={e => setForm({ ...form, active: e.target.checked })} />
        <span>Plan is active</span>
      </label>

      <div className="mt-3">
        <p className="label text-banarasi mb-1">NOTES</p>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
          className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button onClick={save} disabled={saving}
          className="bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
          {saving ? 'SAVING…' : 'SAVE PLAN'}
        </button>
        {msg && <span className="text-xs text-mitti">{msg}</span>}
      </div>
    </div>
  );
}

// ───────────────────────── EXIT / F&F ─────────────────────────
function ExitTab({ employee, onSaved }: any) {
  const today = new Date().toISOString().slice(0, 10);
  const noticePlus = (() => {
    const d = new Date();
    d.setDate(d.getDate() + (employee.noticePeriodDays || 30));
    return d.toISOString().slice(0, 10);
  })();

  const [form, setForm] = useState({
    resignationDate: employee.resignationDate ? new Date(employee.resignationDate).toISOString().slice(0, 10) : today,
    lastWorkingDay:  employee.lastWorkingDay  ? new Date(employee.lastWorkingDay).toISOString().slice(0, 10)  : noticePlus,
    noticePeriodDays: employee.noticePeriodDays || 30,
    noticeShortfallDays: 0,
    leaveBalanceDays: 0,
    exitReason: employee.exitReason || 'resigned',
    bonusDuePaise: 0,
    incentiveDuePaise: 0,
    reimbursementDuePaise: 0,
    loanRecoveryPaise: 0,
    advanceRecoveryPaise: 0,
    otherRecoveryPaise: 0,
    tdsPaise: 0,
    notes: '',
  });
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const settlements = employee.fnfSettlements || [];

  async function previewFnF() {
    setMsg(''); setBusy(true);
    try {
      const r = await fetch(`/api/admin/payroll/employees/${employee.id}/fnf?preview=1`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setPreview(d.preview);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function createDraft() {
    setMsg(''); setBusy(true);
    try {
      const r = await fetch(`/api/admin/payroll/employees/${employee.id}/fnf`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setMsg(`Draft F&F created (${d.settlement.id}).`);
      onSaved();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* Existing settlements */}
      {settlements.length > 0 && (
        <div className="bg-white border border-mitti/10 p-5">
          <h2 className="font-display text-xl text-kohl mb-3">Settlement history</h2>
          <table className="w-full text-xs">
            <thead className="text-mitti uppercase">
              <tr>
                <th className="p-1 text-left">Date</th>
                <th className="p-1 text-left">LWD</th>
                <th className="p-1 text-right">Earnings</th>
                <th className="p-1 text-right">Deductions</th>
                <th className="p-1 text-right">Net</th>
                <th className="p-1 text-left">Status</th>
                <th className="p-1 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s: any) => (
                <tr key={s.id} className="border-t border-mitti/10">
                  <td className="p-1 text-mitti">{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="p-1 text-mitti">{new Date(s.lastWorkingDay).toLocaleDateString('en-IN')}</td>
                  <td className="p-1 text-right tabular-nums text-kohl">{formatINR(s.totalEarningsPaise)}</td>
                  <td className="p-1 text-right tabular-nums text-madder">{formatINR(s.totalDeductionsPaise)}</td>
                  <td className="p-1 text-right tabular-nums font-medium">{formatINR(s.netPayablePaise)}</td>
                  <td className="p-1"><span className={`text-[10px] uppercase px-1.5 py-0.5 ${
                    s.status === 'PAID' ? 'bg-green-100 text-green-800' :
                    s.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
                    s.status === 'CANCELLED' ? 'bg-mitti/20 text-mitti' :
                    'bg-amber-100 text-amber-800'
                  }`}>{s.status}</span></td>
                  <td className="p-1 text-right">
                    <Link href={`/admin/payroll/fnf/${s.id}`} className="text-xs text-madder hover:underline">OPEN →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New F&F draft */}
      <div className="bg-white border border-mitti/10 p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h2 className="font-display text-xl text-kohl">Generate Full & Final settlement</h2>
        </div>
        <p className="text-xs text-mitti mb-4">
          Enter the exit details. Click <b>PREVIEW</b> to compute the statement without saving. Click
          <b> CREATE DRAFT</b> to persist; the employee status will move to <b>ON_NOTICE</b>. Mark as PAID
          on the F&F detail page to finalise the exit.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <DateField label="RESIGNATION DATE"     value={form.resignationDate} onChange={v => setForm({ ...form, resignationDate: v })} />
          <DateField label="LAST WORKING DAY *"   value={form.lastWorkingDay}  onChange={v => setForm({ ...form, lastWorkingDay: v })} />
          <NumField  label="NOTICE PERIOD (DAYS)" value={form.noticePeriodDays} onChange={v => setForm({ ...form, noticePeriodDays: parseInt(v) || 30 })} />
          <NumField  label="NOTICE SHORTFALL (DAYS) — for recovery" value={form.noticeShortfallDays} onChange={v => setForm({ ...form, noticeShortfallDays: parseInt(v) || 0 })} />
          <NumField  label="LEAVE BALANCE (DAYS) — to encash" value={form.leaveBalanceDays} onChange={v => setForm({ ...form, leaveBalanceDays: parseFloat(v) || 0 })} />
          <div>
            <p className="label text-banarasi mb-1">EXIT REASON</p>
            <select value={form.exitReason} onChange={e => setForm({ ...form, exitReason: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
              <option value="absconded">Absconded</option>
              <option value="retired">Retired</option>
              <option value="layoff">Lay-off</option>
              <option value="end_of_contract">End of contract</option>
            </select>
          </div>
        </div>

        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-mitti font-ui tracking-widest uppercase">
            Optional overrides (₹ — leave blank to auto-compute from pending adjustments)
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <PaiseField label="BONUS DUE (₹)"          value={form.bonusDuePaise}         onChange={v => setForm({ ...form, bonusDuePaise: v })} />
            <PaiseField label="INCENTIVE DUE (₹)"      value={form.incentiveDuePaise}     onChange={v => setForm({ ...form, incentiveDuePaise: v })} />
            <PaiseField label="REIMBURSEMENT DUE (₹)"  value={form.reimbursementDuePaise} onChange={v => setForm({ ...form, reimbursementDuePaise: v })} />
            <PaiseField label="LOAN RECOVERY (₹)"      value={form.loanRecoveryPaise}     onChange={v => setForm({ ...form, loanRecoveryPaise: v })} />
            <PaiseField label="ADVANCE RECOVERY (₹)"   value={form.advanceRecoveryPaise}  onChange={v => setForm({ ...form, advanceRecoveryPaise: v })} />
            <PaiseField label="OTHER RECOVERY (₹)"     value={form.otherRecoveryPaise}    onChange={v => setForm({ ...form, otherRecoveryPaise: v })} />
            <PaiseField label="TDS ON F&F (₹)"         value={form.tdsPaise}              onChange={v => setForm({ ...form, tdsPaise: v })} />
          </div>
        </details>

        <div className="mt-3">
          <p className="label text-banarasi mb-1">NOTES</p>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
            className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm"
            placeholder="Handover status, exit interview, asset returns, etc." />
        </div>

        <div className="flex items-center gap-3 mt-5">
          <button onClick={previewFnF} disabled={busy}
            className="bg-banarasi/10 border border-banarasi text-banarasi px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {busy ? 'COMPUTING…' : 'PREVIEW F&F'}
          </button>
          <button onClick={createDraft} disabled={busy}
            className="bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {busy ? 'SAVING…' : 'CREATE DRAFT F&F'}
          </button>
          {msg && <span className="text-xs text-mitti">{msg}</span>}
        </div>
      </div>

      {/* Preview */}
      {preview && <FnFPreview preview={preview} />}
    </div>
  );
}

function FnFPreview({ preview }: { preview: any }) {
  return (
    <div className="bg-white border-2 border-banarasi p-5">
      <h2 className="font-display text-xl text-kohl mb-1">F&F preview</h2>
      <p className="text-[10px] text-mitti mb-4 uppercase tracking-widest">Not yet saved — review and then create the draft.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="label text-banarasi mb-2">Earnings</h3>
          <PreviewRow label={`Pending salary (${preview.pendingDaysWorked} day(s) of final month)`} amount={preview.pendingSalaryPaise} />
          <PreviewRow label={`Leave encashment (${preview.leaveBalanceDays} day(s))`} amount={preview.leaveEncashmentPaise} />
          <PreviewRow label="Bonus due" amount={preview.bonusDuePaise} />
          <PreviewRow label="Incentive due" amount={preview.incentiveDuePaise} />
          <PreviewRow label="Reimbursement due" amount={preview.reimbursementDuePaise} />
          <PreviewRow
            label={`Gratuity${preview.gratuityEligible ? ` (${preview.gratuityTenureYears} yr tenure ✓)` : ` (ineligible — ${preview.gratuityTenureYears} yr < 5 yr)`}`}
            amount={preview.gratuityPaise}
          />
          <div className="border-t border-mitti/20 mt-2 pt-2 flex justify-between font-medium">
            <span>Total earnings</span>
            <span className="tabular-nums text-kohl">{formatINR(preview.totalEarningsPaise)}</span>
          </div>
        </div>

        <div>
          <h3 className="label text-banarasi mb-2">Deductions / Recoveries</h3>
          <PreviewRow label={`Notice shortfall recovery (${preview.noticeShortfallDays} day(s))`} amount={preview.noticeRecoveryPaise} />
          <PreviewRow label="Loan recovery" amount={preview.loanRecoveryPaise} />
          <PreviewRow label="Advance recovery" amount={preview.advanceRecoveryPaise} />
          <PreviewRow label="Other recovery / fines" amount={preview.otherRecoveryPaise} />
          <PreviewRow label="TDS on F&F" amount={preview.tdsPaise} />
          <PreviewRow label="PF (employee, final month)" amount={preview.pfFinalPaise} />
          <PreviewRow label="ESI (employee, final month)" amount={preview.esiFinalPaise} />
          <div className="border-t border-mitti/20 mt-2 pt-2 flex justify-between font-medium">
            <span>Total deductions</span>
            <span className="tabular-nums text-madder">{formatINR(preview.totalDeductionsPaise)}</span>
          </div>
        </div>
      </div>

      <div className={`mt-5 p-4 ${preview.netPayablePaise >= 0 ? 'bg-green-50 border border-green-200' : 'bg-madder/10 border border-madder/30'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-mitti">Net F&F payable</p>
            <p className={`font-display text-3xl mt-1 ${preview.netPayablePaise >= 0 ? 'text-green-800' : 'text-madder'}`}>
              {preview.netPayablePaise >= 0 ? formatINR(preview.netPayablePaise) : `(${formatINR(-preview.netPayablePaise)}) — employee owes`}
            </p>
          </div>
          {preview.netPayablePaise >= 0 ? <CheckCircle2 className="w-8 h-8 text-green-700" /> : <AlertTriangle className="w-8 h-8 text-madder" />}
        </div>
      </div>

      <p className="text-[10px] text-mitti mt-3">
        Calculated using monthly CTC ₹{(preview.sourceMonthlyCtcPaise / 100).toLocaleString('en-IN')},
        basic ₹{(preview.sourceBasicPaise / 100).toLocaleString('en-IN')},
        working days per month: {preview.workingDaysPerMonth}.
      </p>
    </div>
  );
}

function PreviewRow({ label, amount }: { label: string; amount: number }) {
  if (!amount) {
    return (
      <div className="flex justify-between text-xs py-0.5">
        <span className="text-mitti">{label}</span>
        <span className="tabular-nums text-mitti/60">—</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-mitti">{label}</span>
      <span className="tabular-nums text-kohl">{formatINR(amount)}</span>
    </div>
  );
}

// ───────────────────────── shared field components ─────────────────────────
function Section({ title, children }: { title: string; children: any }) {
  return (
    <div className="bg-white border border-mitti/10 p-4">
      <h3 className="label text-mitti mb-2">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-mitti">{label}</span>
      <span className="text-kohl text-right">{value}</span>
    </div>
  );
}
function RupeeField({ label, value, onChange }: { label: string; value: any; onChange: (v: any) => void }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type="number" step="0.01" value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
    </div>
  );
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
    </div>
  );
}
function PaiseField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type="number" step="0.01" value={value / 100}
        onChange={e => onChange(Math.round(parseFloat(e.target.value || '0') * 100))}
        className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
    </div>
  );
}

// ───────────────────────── existing forms (AssignForm + AdjustmentForm) ─────────────────────────
function AssignForm({ employeeId, structures, onSaved, onClose }: any) {
  const [structureId, setStructureId] = useState(structures[0]?.id || '');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setSaving(true);
    try {
      const r = await fetch('/api/admin/payroll/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, structureId, effectiveFrom }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  if (structures.length === 0) {
    return (
      <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4">
        <div className="bg-ivory max-w-md p-6">
          <h3 className="font-display text-xl text-kohl mb-2">No structures yet</h3>
          <p className="text-sm text-mitti mb-4">Create a salary structure first.</p>
          <Link href="/admin/payroll/structures" className="block bg-kohl text-ivory px-4 py-2 text-xs tracking-widest text-center">
            CREATE STRUCTURE
          </Link>
          <button onClick={onClose} className="block w-full mt-2 px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">CANCEL</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-center justify-center p-4">
      <div className="bg-ivory max-w-md w-full p-6">
        <h3 className="font-display text-xl text-kohl mb-4">Assign salary structure</h3>
        <div className="space-y-3">
          <div>
            <p className="label text-banarasi mb-1">STRUCTURE</p>
            <select value={structureId} onChange={e => setStructureId(e.target.value)}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
              {structures.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({formatINR(s.monthlyCtcPaise)}/mo)</option>
              ))}
            </select>
          </div>
          <div>
            <p className="label text-banarasi mb-1">EFFECTIVE FROM</p>
            <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
        </div>
        {err && <p className="mt-3 text-madder text-xs">{err}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={saving} className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'SAVING…' : 'ASSIGN'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

function AdjustmentForm({ employeeId, onSaved, onClose }: any) {
  const now = new Date();
  const [form, setForm] = useState({
    forMonth: now.getMonth() + 1, forYear: now.getFullYear(),
    kind: 'INCENTIVE', amountRupees: '', description: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setSaving(true);
    try {
      if (!form.amountRupees || !form.description) throw new Error('Amount and description required');
      const r = await fetch('/api/admin/payroll/adjustments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          forMonth: form.forMonth,
          forYear: form.forYear,
          kind: form.kind,
          amountPaise: Math.round(parseFloat(form.amountRupees) * 100),
          description: form.description,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-ivory max-w-md w-full p-6 my-8">
        <h3 className="font-display text-xl text-kohl mb-4">Add adjustment</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="label text-banarasi mb-1">FOR MONTH</p>
              <select value={form.forMonth} onChange={e => setForm({ ...form, forMonth: parseInt(e.target.value) })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <p className="label text-banarasi mb-1">YEAR</p>
              <input type="number" value={form.forYear} onChange={e => setForm({ ...form, forYear: parseInt(e.target.value) })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
            </div>
          </div>
          <div>
            <p className="label text-banarasi mb-1">KIND</p>
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
              <optgroup label="Earnings (add to pay)">
                <option value="INCENTIVE">Incentive</option>
                <option value="BONUS">Bonus</option>
                <option value="REIMBURSEMENT">Reimbursement</option>
                <option value="OTHER_EARNING">Other earning</option>
              </optgroup>
              <optgroup label="Deductions (subtract from pay)">
                <option value="ADVANCE">Advance recovery</option>
                <option value="LOAN_EMI">Loan EMI</option>
                <option value="FINE">Fine</option>
                <option value="OTHER_DEDUCTION">Other deduction</option>
              </optgroup>
            </select>
          </div>
          <div>
            <p className="label text-banarasi mb-1">AMOUNT (₹)</p>
            <input type="number" value={form.amountRupees} onChange={e => setForm({ ...form, amountRupees: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
          <div>
            <p className="label text-banarasi mb-1">DESCRIPTION</p>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Q2 performance bonus"
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>
        </div>
        {err && <p className="mt-3 text-madder text-xs">{err}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={saving} className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'SAVING…' : 'ADD'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">CANCEL</button>
        </div>
      </div>
    </div>
  );
}
