'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatINR } from '@/lib/money';
import { Plus, Loader2, Receipt, AlertCircle, CheckCircle2, RefreshCw, Lock } from 'lucide-react';
import { MultiFileInput } from '@/components/admin/MultiFileInput';
import { CategorySelect } from '@/components/admin/finance/CategorySelect';
import { VendorAutocomplete } from '@/components/admin/finance/VendorAutocomplete';

type LoadState = 'idle' | 'loading' | 'ready' | 'unauthenticated' | 'forbidden' | 'error';

const STATUS: Record<string, { l: string; cls: string }> = {
  DRAFT: { l: 'Draft', cls: 'bg-mitti/10 text-mitti' },
  OPEN: { l: 'Open', cls: 'bg-banarasi/15 text-banarasi' },
  OVERDUE: { l: 'Overdue', cls: 'bg-madder/20 text-madder' },
  PARTIALLY_PAID: { l: 'Partially paid', cls: 'bg-banarasi/30 text-kohl' },
  PAID: { l: 'Paid', cls: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { l: 'Cancelled', cls: 'bg-mitti/10 text-mitti/60' },
};

async function readJsonSafe(res: Response) {
  const raw = await res.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { error: raw || `Request failed with status ${res.status}` };
  }
}

export default function BillsPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [filter, setFilter] = useState('OPEN');
  const [showNew, setShowNew] = useState(false);
  const [showPayFor, setShowPayFor] = useState<string>('');
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  const load = async () => {
    setState('loading');
    setErrMsg('');

    try {
      const params = new URLSearchParams();
      if (filter && filter !== 'ALL') params.set('status', filter);

      const [bR, cR] = await Promise.all([
        fetch(`/api/admin/finance/bills?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
        fetch('/api/admin/finance/categories', {
          credentials: 'include',
          cache: 'no-store',
        }),
      ]);

      if (bR.status === 401 || cR.status === 401) {
        setState('unauthenticated');
        return;
      }

      if (bR.status === 403 || cR.status === 403) {
        const bJ = await readJsonSafe(bR);
        const cJ = await readJsonSafe(cR);
        setErrMsg(bJ.error || cJ.error || 'You do not have finance access for this page.');
        setState('forbidden');
        return;
      }

      const bJ = await readJsonSafe(bR);
      const cJ = await readJsonSafe(cR);

      if (!bR.ok || !cR.ok) {
        throw new Error(bJ.error || cJ.error || 'Could not load bills.');
      }

      setBills(Array.isArray(bJ.bills) ? bJ.bills : []);
      setCats(Array.isArray(cJ.categories) ? cJ.categories.filter((c: any) => c.isActive) : []);
      setState('ready');
    } catch (err: any) {
      setErrMsg(err?.message || 'Could not load bills.');
      setState('error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const emptyState = useMemo(() => {
    if (state === 'unauthenticated') {
      return (
        <div className="bg-ivory border border-mitti/20 rounded p-10 text-center space-y-3">
          <AlertCircle className="w-6 h-6 mx-auto text-madder" />
          <h3 className="font-display text-2xl text-kohl">Please sign in again</h3>
          <p className="text-sm text-mitti max-w-xl mx-auto">
            Your admin shell may still be visible, but the finance APIs are not seeing a valid session cookie.
            Sign in again and reopen Bills.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/login?next=/admin/finance/bills" className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest">
              SIGN IN
            </Link>
            <button onClick={load} className="border border-mitti/30 text-mitti px-4 py-2 font-ui text-xs tracking-widest inline-flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> RETRY
            </button>
          </div>
        </div>
      );
    }

    if (state === 'forbidden') {
      return (
        <div className="bg-ivory border border-mitti/20 rounded p-10 text-center space-y-3">
          <Lock className="w-6 h-6 mx-auto text-banarasi" />
          <h3 className="font-display text-2xl text-kohl">Finance access required</h3>
          <p className="text-sm text-mitti max-w-xl mx-auto">
            You are signed in, but this page requires a finance-enabled role such as ADMIN, SUPER_ADMIN,
            FINANCE, or FINANCE_OPERATOR.
          </p>
          {errMsg && <p className="text-xs text-madder">{errMsg}</p>}
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/admin" className="border border-mitti/30 text-mitti px-4 py-2 font-ui text-xs tracking-widest">
              BACK TO ADMIN
            </Link>
            <button onClick={load} className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest inline-flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> RETRY
            </button>
          </div>
        </div>
      );
    }

    if (state === 'error') {
      return (
        <div className="bg-ivory border border-mitti/20 rounded p-10 text-center space-y-3">
          <AlertCircle className="w-6 h-6 mx-auto text-madder" />
          <h3 className="font-display text-2xl text-kohl">Could not load Bills</h3>
          <p className="text-sm text-mitti max-w-xl mx-auto">{errMsg || 'Something went wrong while loading finance data.'}</p>
          <div className="flex justify-center pt-2">
            <button onClick={load} className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest inline-flex items-center gap-2">
              <RefreshCw className="w-3 h-3" /> TRY AGAIN
            </button>
          </div>
        </div>
      );
    }

    return null;
  }, [state, errMsg]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl text-kohl">Bills (Accounts Payable)</h2>
          <p className="text-sm text-mitti mt-2 max-w-3xl">
            Bills are obligations to pay. They mirror into finance ledgers and linked expenses, while recurring templates,
            PO receipts, and integrations can auto-create draft or open bills.
          </p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest"
        >
          <Plus className="w-3 h-3" /> {showNew ? 'CLOSE' : 'NEW BILL'}
        </button>
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm flex items-center gap-2 text-emerald-800">
          <CheckCircle2 className="w-4 h-4" /> {msg}
        </div>
      )}

      {showNew && state === 'ready' && <NewBillForm categories={cats} onSaved={() => { setShowNew(false); load(); }} />}

      <div className="flex gap-2 flex-wrap">
        {['ALL', 'OPEN', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase ${
              filter === s ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'
            }`}
          >
            {s === 'ALL' ? 'All' : STATUS[s]?.l || s}
          </button>
        ))}
      </div>

      {state === 'loading' ? (
        <div className="text-mitti py-12 text-center">
          <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...
        </div>
      ) : emptyState ? (
        emptyState
      ) : bills.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic rounded">
          No bills found for this filter.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">DUE</th>
                <th className="text-left p-3">DESCRIPTION</th>
                <th className="text-left p-3">VENDOR</th>
                <th className="text-left p-3">CATEGORY</th>
                <th className="text-right p-3">TOTAL</th>
                <th className="text-right p-3">PAID</th>
                <th className="text-right p-3">BALANCE</th>
                <th className="text-center p-3">STATUS</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const stat = STATUS[b.status] || { l: b.status, cls: '' };
                const outstanding = b.totalPaise - b.paidPaise;
                const isOverdue = b.status === 'OVERDUE';
                const attachments: string[] = Array.isArray(b.attachments) && b.attachments.length
                  ? b.attachments
                  : (b.receiptUrl ? [b.receiptUrl] : []);

                return (
                  <tr key={b.id} className={`border-t border-mitti/10 hover:bg-beige/20 ${isOverdue ? 'bg-madder/5' : ''}`}>
                    <td className="p-3 text-mitti whitespace-nowrap text-xs">
                      {new Date(b.dueOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="p-3 text-kohl">
                      <span>{b.description}</span>
                      {attachments.length > 0 && (
                        <a
                          href={attachments[0]}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-xs text-banarasi hover:underline inline-flex items-center gap-1"
                          title={attachments.length > 1 ? `${attachments.length} files attached` : 'View attachment'}
                        >
                          <Receipt className="w-3 h-3" /> {attachments.length > 1 ? `${attachments.length} files` : 'file'}
                        </a>
                      )}
                      {b.billNumber && <span className="text-xs text-mitti ml-2">#{b.billNumber}</span>}
                      {b.expenseId && (
                        <a
                          href={`/admin/finance/expenses?highlight=${b.expenseId}`}
                          className="ml-2 text-[10px] tracking-widest px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 inline-flex items-center gap-1"
                          title="Linked P&L expense (auto-created)"
                        >
                          EXPENSE LINK
                        </a>
                      )}
                    </td>
                    <td className="p-3 text-mitti text-xs">
                      {b.vendorId ? (
                        <a href={`/admin/finance/vendor-ledger/${b.vendorId}`} className="hover:text-madder underline" title="View vendor ledger">
                          {b.vendorNameSnapshot || 'View ledger'}
                        </a>
                      ) : (
                        b.vendorNameSnapshot || '-'
                      )}
                    </td>
                    <td className="p-3 text-mitti text-xs">{b.category?.label || '-'}</td>
                    <td className="p-3 text-right tabular-nums text-kohl">{formatINR(b.totalPaise)}</td>
                    <td className="p-3 text-right tabular-nums text-emerald-700">{formatINR(b.paidPaise)}</td>
                    <td className={`p-3 text-right tabular-nums ${outstanding > 0 ? 'text-madder' : 'text-mitti/40'}`}>
                      {formatINR(outstanding)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] tracking-widest ${stat.cls}`}>
                        {stat.l}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {b.status !== 'PAID' && b.status !== 'CANCELLED' && (
                        <button
                          onClick={() => setShowPayFor(b.id)}
                          className="text-xs font-ui tracking-widest bg-emerald-600 text-white px-2 py-1 rounded"
                        >
                          PAY
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPayFor && state === 'ready' && (
        <PayModal
          billId={showPayFor}
          bills={bills}
          onClose={() => setShowPayFor('')}
          onPaid={(amt) => {
            setMsg(`Payment of ${formatINR(amt)} recorded.`);
            setShowPayFor('');
            load();
          }}
        />
      )}
    </div>
  );
}

function NewBillForm({ categories: initialCategories, onSaved }: { categories: any[]; onSaved: () => void }) {
  const [categories, setCategories] = useState<any[]>(initialCategories);
  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const today = new Date().toISOString().slice(0, 10);
  const due30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    billNumber: '',
    description: '',
    categoryId: '',
    vendorId: null as string | null,
    vendorNameSnapshot: '',
    amountRupees: '',
    gstRupees: '',
    issuedOn: today,
    dueOn: due30,
    receiptUrl: '',
    attachments: [] as string[],
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      if (!form.description || !form.categoryId || !form.amountRupees) {
        throw new Error('Description, category and amount are required.');
      }

      const r = await fetch('/api/admin/finance/bills', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          receiptUrl: form.attachments[0] || form.receiptUrl || null,
          attachments: form.attachments,
          amountPaise: Math.round(parseFloat(form.amountRupees) * 100),
          gstPaise: Math.round(parseFloat(form.gstRupees || '0') * 100),
        }),
      });
      const j = await readJsonSafe(r);
      if (!r.ok) throw new Error(j.error || 'Could not create bill.');
      onSaved();
    } catch (e: any) {
      setErr(e.message || 'Could not create bill.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-ivory border border-mitti/30 p-6 rounded">
      <h3 className="font-display text-xl text-kohl mb-4">New bill</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="DESCRIPTION *" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="e.g. June office rent" />
        <Field label="BILL # (vendor invoice)" value={form.billNumber} onChange={(v) => setForm({ ...form, billNumber: v })} />
        <div>
          <p className="label text-banarasi mb-1">CATEGORY *</p>
          <CategorySelect
            value={form.categoryId}
            onChange={(id) => setForm({ ...form, categoryId: id })}
            categories={categories}
            onCategoriesChanged={setCategories}
            required
          />
        </div>
        <div className="md:col-span-2">
          <VendorAutocomplete
            vendorId={form.vendorId}
            vendorName={form.vendorNameSnapshot}
            onChange={({ vendorId, vendorName }) => setForm({ ...form, vendorId, vendorNameSnapshot: vendorName })}
          />
        </div>
        <Field label="AMOUNT (INR) *" type="number" value={form.amountRupees} onChange={(v) => setForm({ ...form, amountRupees: v })} />
        <Field label="GST (INR)" type="number" value={form.gstRupees} onChange={(v) => setForm({ ...form, gstRupees: v })} />
        <Field label="ISSUED ON *" type="date" value={form.issuedOn} onChange={(v) => setForm({ ...form, issuedOn: v })} />
        <Field label="DUE ON *" type="date" value={form.dueOn} onChange={(v) => setForm({ ...form, dueOn: v })} />
      </div>
      <div className="mt-3">
        <p className="label text-banarasi mb-1">VENDOR INVOICE / SUPPORTING FILES</p>
        <MultiFileInput
          value={form.attachments}
          onChange={(urls) => setForm({ ...form, attachments: urls, receiptUrl: urls[0] || '' })}
          folder="finance-bills"
          label="ATTACH FILES"
          helpText="Images (PNG/JPG/WebP), PDF, Excel, CSV - attach multiple"
          maxFiles={10}
        />
      </div>
      <div className="mt-3">
        <p className="label text-banarasi mb-1">NOTES</p>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory"
        />
      </div>
      {err && <div className="mt-3 bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}
      <button
        onClick={submit}
        disabled={saving}
        className="mt-4 bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50"
      >
        {saving ? 'SAVING...' : 'CREATE BILL'}
      </button>
    </div>
  );
}

function PayModal({ billId, bills, onClose, onPaid }: { billId: string; bills: any[]; onClose: () => void; onPaid: (amt: number) => void }) {
  const bill = bills.find((b) => b.id === billId);
  const outstanding = bill ? bill.totalPaise - bill.paidPaise : 0;
  const [form, setForm] = useState({
    amountRupees: (outstanding / 100).toFixed(2),
    paidOn: new Date().toISOString().slice(0, 10),
    method: 'BANK_TRANSFER',
    reference: '',
    notes: '',
    receiptUrl: '',
    attachments: [] as string[],
    autoExpense: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  if (!bill) return null;

  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const amt = Math.round(parseFloat(form.amountRupees) * 100);
      if (!amt || amt <= 0) throw new Error('Amount must be greater than 0.');
      if (amt > outstanding) throw new Error(`Cannot exceed outstanding ${formatINR(outstanding)}.`);

      const r = await fetch(`/api/admin/finance/bills/${billId}/payments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: amt,
          paidOn: form.paidOn,
          method: form.method,
          reference: form.reference || null,
          notes: form.notes || null,
          receiptUrl: form.attachments[0] || form.receiptUrl || null,
          attachments: form.attachments,
          autoExpense: form.autoExpense,
        }),
      });
      const j = await readJsonSafe(r);
      if (!r.ok) throw new Error(j.error || 'Could not record payment.');
      onPaid(amt);
    } catch (e: any) {
      setErr(e.message || 'Could not record payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-kohl/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-ivory rounded-lg max-w-md w-full p-6">
        <h3 className="font-display text-xl text-kohl">Record payment</h3>
        <p className="text-mitti text-sm mt-1">{bill.description}</p>
        <p className="text-mitti text-xs mt-1">
          Outstanding: <strong className="text-kohl">{formatINR(outstanding)}</strong>
        </p>

        <div className="space-y-3 mt-5">
          <Field label="AMOUNT (INR) *" type="number" value={form.amountRupees} onChange={(v) => setForm({ ...form, amountRupees: v })} />
          <Field label="PAID ON *" type="date" value={form.paidOn} onChange={(v) => setForm({ ...form, paidOn: v })} />
          <div>
            <p className="label text-banarasi mb-1">METHOD</p>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory"
            >
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="UPI">UPI</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
              <option value="RAZORPAY_PAYOUT">Razorpay payout</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <Field label="REFERENCE / UTR" value={form.reference} onChange={(v) => setForm({ ...form, reference: v })} />
          <MultiFileInput
            value={form.attachments}
            onChange={(urls) => setForm({ ...form, attachments: urls, receiptUrl: urls[0] || '' })}
            folder="finance-payments"
            label="PAYMENT RECEIPTS (optional)"
            helpText="Images, PDF - attach multiple"
            maxFiles={6}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.autoExpense} onChange={(e) => setForm({ ...form, autoExpense: e.target.checked })} />
            <span>Auto-create P&L expense entry</span>
          </label>
        </div>

        {err && <div className="mt-3 bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

        <div className="flex gap-2 mt-5">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest disabled:opacity-50"
          >
            {saving ? 'RECORDING...' : 'RECORD PAYMENT'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti font-ui text-xs tracking-widest">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory"
      />
    </div>
  );
}
