'use client';
// v23.40.1 — Employee list + scrollable New-Employee modal with personal-file documents.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft, X } from 'lucide-react';
import { formatINR } from '@/lib/money';
import { MultiFileInput } from '@/components/admin/MultiFileInput';

interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  status: string;
  joiningDate: string;
  salaryAssignments: Array<{
    structure: { id: string; name: string; monthlyCtcPaise: number };
    effectiveFrom: string;
  }>;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<'all' | 'ACTIVE' | 'ON_NOTICE' | 'EXITED'>('ACTIVE');

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/payroll/employees');
    const d = await r.json();
    setEmployees(d.employees || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = employees.filter(e => filter === 'all' || e.status === filter);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/payroll" className="text-xs text-mitti hover:text-madder flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Back to payroll
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Employees</h1>
          <p className="text-mitti text-sm mt-1">
            {employees.length} total · {employees.filter(e => e.status === 'ACTIVE').length} active
          </p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1 px-3 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
          <Plus className="w-3 h-3" /> ADD EMPLOYEE
        </button>
      </div>

      <div className="flex gap-1 mb-4 border-b border-mitti/10">
        {(['ACTIVE', 'ON_NOTICE', 'EXITED', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs uppercase tracking-widest ${filter === f ? 'border-b-2 border-madder text-kohl' : 'text-mitti hover:text-kohl'}`}>
            {f === 'all' ? 'ALL' : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {showNew && <NewEmployeeForm onSaved={() => { setShowNew(false); load(); }} onClose={() => setShowNew(false)} />}

      {loading ? <p className="text-mitti">Loading…</p> :
       filtered.length === 0 ? (
        <p className="text-mitti italic">No employees in this filter.</p>
      ) : (
        <table className="w-full bg-white border border-mitti/10 text-sm">
          <thead className="bg-beige text-mitti text-xs uppercase tracking-wider">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Designation</th>
              <th className="p-3 text-left">Department</th>
              <th className="p-3 text-right">CTC (monthly)</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const current = e.salaryAssignments?.[0];
              return (
                <tr key={e.id} className="border-t border-mitti/10 hover:bg-beige/30">
                  <td className="p-3 text-mitti font-mono text-xs">{e.employeeCode}</td>
                  <td className="p-3 text-kohl">
                    {e.firstName} {e.lastName}
                    {e.email && <span className="block text-[10px] text-mitti">{e.email}</span>}
                  </td>
                  <td className="p-3 text-mitti">{e.designation || '—'}</td>
                  <td className="p-3 text-mitti">{e.department || '—'}</td>
                  <td className="p-3 text-right tabular-nums text-kohl">
                    {current ? formatINR(current.structure.monthlyCtcPaise) : <span className="text-amber-700 text-xs">No structure</span>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] uppercase px-2 py-0.5 ${
                      e.status === 'ACTIVE'    ? 'bg-green-100 text-green-800' :
                      e.status === 'ON_NOTICE' ? 'bg-amber-100 text-amber-800' :
                      'bg-mitti/20 text-kohl'
                    }`}>{e.status.replace('_', ' ')}</span>
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/payroll/employees/${e.id}`} className="text-xs text-madder hover:underline">OPEN →</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewEmployeeForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    employeeCode: '', firstName: '', lastName: '', email: '', phone: '',
    pan: '', aadhaarLast4: '', dob: '', designation: '', department: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    employmentType: 'FULL_TIME',
    bankAccountName: '', bankAccountNumber: '', bankIfsc: '',
    uanNumber: '', esicNumber: '', taxRegime: 'NEW',
    address: '', emergencyContact: '', notes: '',
    noticePeriodDays: 30,
    photoUrl: '',
    documents: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setSaving(true);
    try {
      if (!form.firstName || !form.joiningDate) {
        throw new Error('First name and joining date are required');
      }
      const r = await fetch('/api/admin/payroll/employees', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      onSaved();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  // v23.40.1 — scrollable modal: align top, cap height, scroll body
  return (
    <div
      className="fixed inset-0 bg-kohl/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-ivory max-w-3xl w-full my-8 max-h-[calc(100vh-4rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-mitti/10 sticky top-0 bg-ivory z-10">
          <h3 className="font-display text-xl text-kohl">New employee</h3>
          <button onClick={onClose} className="text-mitti hover:text-madder"><X className="w-5 h-5" /></button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-6">
          <FormSection title="Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="label text-banarasi mb-1">EMPLOYEE CODE</p>
                <input type="text" value={form.employeeCode} onChange={e => setForm({ ...form, employeeCode: e.target.value.toUpperCase() })}
                  placeholder="Leave blank — auto-allotted as EMP-YYMM-NNN"
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
                <p className="text-[10px] text-mitti mt-0.5">Optional. Auto-pattern: EMP-YYMM-NNN (year+month of joining + next sequence). e.g. EMP-2606-001.</p>
              </div>
              <Field label="JOINING DATE *" type="date" value={form.joiningDate} onChange={v => setForm({ ...form, joiningDate: v })} />
              <Field label="FIRST NAME *" value={form.firstName} onChange={v => setForm({ ...form, firstName: v })} />
              <Field label="LAST NAME" value={form.lastName} onChange={v => setForm({ ...form, lastName: v })} />
              <Field label="EMAIL" type="email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
              <Field label="PHONE" value={form.phone} onChange={v => setForm({ ...form, phone: v })} placeholder="+91…" />
              <Field label="DESIGNATION" value={form.designation} onChange={v => setForm({ ...form, designation: v })} />
              <Field label="DEPARTMENT" value={form.department} onChange={v => setForm({ ...form, department: v })} />
              <Field label="DOB" type="date" value={form.dob} onChange={v => setForm({ ...form, dob: v })} />
              <div>
                <p className="label text-banarasi mb-1">EMPLOYMENT TYPE</p>
                <select value={form.employmentType} onChange={e => setForm({ ...form, employmentType: e.target.value })}
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERN">Intern</option>
                </select>
              </div>
              <Field label="NOTICE PERIOD (DAYS)" type="number" value={String(form.noticePeriodDays)} onChange={v => setForm({ ...form, noticePeriodDays: parseInt(v) || 30 })} placeholder="30" />
              <Field label="EMERGENCY CONTACT" value={form.emergencyContact} onChange={v => setForm({ ...form, emergencyContact: v })} />
            </div>
          </FormSection>

          <FormSection title="KYC & Statutory">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="PAN" value={form.pan} onChange={v => setForm({ ...form, pan: v.toUpperCase() })} placeholder="ABCDE1234F" />
              <Field label="AADHAAR (LAST 4)" value={form.aadhaarLast4} onChange={v => setForm({ ...form, aadhaarLast4: v })} placeholder="1234" />
              <Field label="UAN (PF)" value={form.uanNumber} onChange={v => setForm({ ...form, uanNumber: v })} />
              <Field label="ESIC NUMBER" value={form.esicNumber} onChange={v => setForm({ ...form, esicNumber: v })} />
              <div>
                <p className="label text-banarasi mb-1">TAX REGIME</p>
                <select value={form.taxRegime} onChange={e => setForm({ ...form, taxRegime: e.target.value })}
                  className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
                  <option value="NEW">New regime</option>
                  <option value="OLD">Old regime</option>
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection title="Bank (for salary credit)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="BANK A/C NAME" value={form.bankAccountName} onChange={v => setForm({ ...form, bankAccountName: v })} />
              <Field label="BANK A/C NUMBER" value={form.bankAccountNumber} onChange={v => setForm({ ...form, bankAccountNumber: v })} />
              <Field label="IFSC" value={form.bankIfsc} onChange={v => setForm({ ...form, bankIfsc: v.toUpperCase() })} />
            </div>
          </FormSection>

          <FormSection title="Address">
            <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" placeholder="Full residential address" />
          </FormSection>

          <FormSection title="Personal file — supporting documents">
            <p className="text-xs text-mitti mb-3">
              Upload PAN copy, Aadhaar (masked), cancelled cheque, passport-size photo, signed offer letter, bank passbook, previous employer relieving letter, educational certificates, address proof, photo, etc. Multiple files allowed (PDF / images).
            </p>
            <MultiFileInput
              value={form.documents}
              onChange={(urls) => setForm({ ...form, documents: urls, photoUrl: form.photoUrl || urls.find(u => /\.(png|jpe?g|webp)$/i.test(u)) || '' })}
              folder="payroll-employees"
              label="EMPLOYEE DOCUMENTS"
              helpText="PAN, Aadhaar, cancelled cheque, photo, offer letter, etc. — multiple files allowed"
              maxFiles={20}
              maxSizeMB={20}
            />
          </FormSection>

          <FormSection title="HR notes">
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" placeholder="Probation terms, special arrangements, etc." />
          </FormSection>

          {err && <p className="mt-3 text-madder text-xs bg-madder/10 border border-madder/30 p-2">{err}</p>}
        </div>

        {/* Sticky footer */}
        <div className="flex gap-2 p-6 pt-4 border-t border-mitti/10 sticky bottom-0 bg-ivory">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'CREATING…' : 'CREATE EMPLOYEE'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: any }) {
  return (
    <div className="mb-5">
      <h4 className="label text-banarasi mb-2 pb-1 border-b border-mitti/10">{title}</h4>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
    </div>
  );
}
