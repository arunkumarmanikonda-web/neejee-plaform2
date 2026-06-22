'use client';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/money';
import { Plus, Loader2, Check, X, Receipt as ReceiptIcon, Wallet, CheckCircle2 } from 'lucide-react';
import { MultiFileInput } from '@/components/admin/MultiFileInput';
import { CategorySelect } from '@/components/admin/finance/CategorySelect';
import { VendorAutocomplete } from '@/components/admin/finance/VendorAutocomplete';

type Expense = {
  id: string;
  description: string;
  amountPaise: number;
  gstPaise: number;
  totalPaise: number;
  // v23.40.2 — payment tracking
  paidPaise?: number;
  paymentStatus?: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  payments?: Array<{ id: string; amountPaise: number; paidOn: string; method: string | null }>;
  incurredOn: string;
  paidOn: string | null;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  receiptUrl: string | null;
  attachments?: string[];
  invoiceNumber: string | null;
  vendorId: string | null;
  vendorNameSnapshot: string | null;
  // v23.40.10
  source?: string;
  sourceRef?: string | null;
  createdAt: string;
  reviewNote: string | null;
  category: { id: string; code: string; label: string; group: string };
};

type Category = {
  id: string; code: string; label: string; group: string; isActive: boolean;
  approvalThresholdPaise: number | null;
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT:    'bg-mitti/10 text-mitti',
  PENDING:  'bg-banarasi/20 text-banarasi',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-madder/10 text-madder',
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState('');
  // v23.40.2 — payment modal state
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const [eR, cR] = await Promise.all([
        fetch(`/api/admin/finance/expenses?${params}`),
        fetch('/api/admin/finance/categories'),
      ]);
      const eJ = await eR.json();
      const cJ = await cR.json();
      setExpenses(eJ.expenses || []);
      setCategories((cJ.categories || []).filter((c: Category) => c.isActive));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterStatus]);

  // Open new form via ?new=1
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('new=1')) {
      setShowNew(true);
    }
  }, []);

  const review = async (id: string, action: 'approve' | 'reject') => {
    let note = '';
    if (action === 'reject') {
      note = prompt('Reason for rejection?') || '';
      if (!note.trim()) return;
    }
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/finance/expenses/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(`Expense ${action}d`);
      await load();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-kohl">Expenses</h2>
        <button onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest">
          <Plus className="w-3 h-3" /> {showNew ? 'CLOSE' : 'NEW EXPENSE'}
        </button>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}

      {/* New form */}
      {showNew && (
        <NewExpenseForm categories={categories} onSaved={() => { setShowNew(false); load(); }} />
      )}

      {/* v23.40.2 — Payment modal */}
      {payingExpense && (
        <PayExpenseModal
          expense={payingExpense}
          onClose={() => setPayingExpense(null)}
          onPaid={() => { setPayingExpense(null); load(); setMsg('Payment recorded.'); }}
        />
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {[
          { v: '', l: 'All' },
          { v: 'PENDING', l: 'Pending' },
          { v: 'APPROVED', l: 'Approved' },
          { v: 'REJECTED', l: 'Rejected' },
          { v: 'DRAFT', l: 'Drafts' },
        ].map(f => (
          <button key={f.v} onClick={() => setFilterStatus(f.v)}
            className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase ${filterStatus === f.v ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'}`}>
            {f.l}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-mitti py-12 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
      ) : expenses.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti">
          No expenses {filterStatus ? `with status ${filterStatus}` : 'yet'}.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">DATE</th>
                <th className="text-left p-3">DESCRIPTION</th>
                <th className="text-left p-3">CATEGORY</th>
                <th className="text-right p-3">AMOUNT</th>
                <th className="text-center p-3">STATUS</th>
                <th className="text-right p-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-t border-mitti/10 hover:bg-beige/20">
                  <td className="p-3 text-mitti whitespace-nowrap">
                    {new Date(e.incurredOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="p-3 text-kohl">
                    {e.description}
                    {e.source === 'BILL' && e.sourceRef && (
                      <a href={`/admin/finance/bills?id=${e.sourceRef}`}
                        className="inline-flex items-center gap-1 ml-2 text-[10px] tracking-widest bg-banarasi/10 text-banarasi px-1.5 py-0.5"
                        title="Auto-created from a Bill — click to open">
                        FROM BILL ↗
                      </a>
                    )}
                    {(() => {
                      const atts: string[] = (e.attachments && e.attachments.length) ? e.attachments : (e.receiptUrl ? [e.receiptUrl] : []);
                      if (!atts.length) return null;
                      return (
                        <a href={atts[0]} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 ml-2 text-xs text-banarasi hover:underline"
                          title={atts.length > 1 ? `${atts.length} files attached` : 'View receipt'}>
                          <ReceiptIcon className="w-3 h-3" /> {atts.length > 1 ? `${atts.length} files` : 'receipt'}
                        </a>
                      );
                    })()}
                    {(e.vendorNameSnapshot || e.vendorId) && (
                      e.vendorId ? (
                        <a href={`/admin/finance/vendor-ledger/${e.vendorId}`}
                          className="ml-2 text-xs text-banarasi hover:underline"
                          title="Open vendor ledger">
                          · {e.vendorNameSnapshot || 'Linked vendor'} ↗
                        </a>
                      ) : (
                        <span className="ml-2 text-xs text-mitti/60">· {e.vendorNameSnapshot}</span>
                      )
                    )}
                  </td>
                  <td className="p-3 text-mitti text-xs">{e.category.label}</td>
                  <td className="p-3 text-right tabular-nums text-kohl">
                    {formatINR(e.totalPaise)}
                    {e.gstPaise > 0 && <div className="text-[10px] text-mitti">GST {formatINR(e.gstPaise)}</div>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] tracking-widest ${STATUS_STYLE[e.status]}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end items-center">
                      {/* v23.40.2 — inline payment status + Pay button on APPROVED */}
                      {e.status === 'APPROVED' && (() => {
                        const paid = e.paidPaise || 0;
                        const outstanding = e.totalPaise - paid;
                        if (e.paymentStatus === 'PAID' || outstanding <= 0) {
                          const pmtCount = e.payments?.length || 0;
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] tracking-widest text-emerald-700 bg-emerald-50 px-2 py-1"
                              title={pmtCount > 0 ? `${pmtCount} payment(s) recorded` : 'Marked PAID without a payment record (legacy / imported)'}>
                              <CheckCircle2 className="w-3 h-3" /> PAID{pmtCount > 0 ? ` · ${pmtCount}` : ' (legacy)'}
                            </span>
                          );
                        }
                        return (
                          <button onClick={() => setPayingExpense(e)} disabled={busy === e.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-banarasi text-ivory rounded text-[10px] tracking-widest hover:bg-banarasi/80 disabled:opacity-50"
                            title={e.paymentStatus === 'PARTIALLY_PAID' ? `₹${(outstanding/100).toLocaleString('en-IN')} pending` : 'Record payment'}>
                            <Wallet className="w-3 h-3" />
                            {e.paymentStatus === 'PARTIALLY_PAID' ? 'PAY MORE' : 'PAY'}
                          </button>
                        );
                      })()}
                      {e.status === 'PENDING' && (
                        <>
                          <button onClick={() => review(e.id, 'approve')} disabled={busy === e.id}
                            className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50" title="Approve">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => review(e.id, 'reject')} disabled={busy === e.id}
                            className="p-1.5 bg-madder text-white rounded hover:bg-madder/80 disabled:opacity-50" title="Reject">
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
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

function NewExpenseForm({ categories: initialCategories, onSaved }: { categories: Category[]; onSaved: () => void }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  // v23.39.4 — sync prop changes (parent loads categories asynchronously)
  useEffect(() => { setCategories(initialCategories); }, [initialCategories]);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    categoryId: '',
    description: '',
    amountRupees: '',
    gstRupees: '',
    incurredOn: today,
    paidOn: today,
    vendorId: null as string | null,
    vendorNameSnapshot: '',
    invoiceNumber: '',
    receiptUrl: '',
    attachments: [] as string[],
    notes: '',
    status: 'submit' as 'submit' | 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      const amt = Math.round(parseFloat(form.amountRupees || '0') * 100);
      const gst = Math.round(parseFloat(form.gstRupees || '0') * 100);
      if (!form.categoryId) throw new Error('Pick a category');
      if (!form.description.trim()) throw new Error('Description required');
      if (amt <= 0) throw new Error('Amount must be > 0');

      const r = await fetch('/api/admin/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: form.categoryId,
          description: form.description,
          amountPaise: amt,
          gstPaise: gst,
          incurredOn: form.incurredOn,
          paidOn: form.paidOn || null,
          vendorId: form.vendorId || null,
          vendorNameSnapshot: form.vendorNameSnapshot || null,
          invoiceNumber: form.invoiceNumber || null,
          receiptUrl: form.attachments[0] || form.receiptUrl || null,
          attachments: form.attachments,
          notes: form.notes || null,
          ...(form.status === 'draft' ? { status: 'DRAFT' } : {}),
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
      <h3 className="font-display text-xl text-kohl mb-2">New expense</h3>
      <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 p-3 mb-4 rounded">
        <b>Quick expense (no bill).</b> Use this for petty cash, fuel, small reimbursements where there is no vendor invoice document.
        If you have a vendor invoice (e.g. Jio bill, AWS invoice), book it as a <a href="/admin/finance/bills" className="underline">Bill</a> instead —
        a mirror Expense will be auto-created, the vendor ledger entry posts immediately, and every payment cascades to both sides.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="label text-banarasi mb-1">CATEGORY *</p>
          <CategorySelect
            value={form.categoryId}
            onChange={(id) => setForm({ ...form, categoryId: id })}
            categories={categories as any}
            onCategoriesChanged={setCategories as any}
            required
          />
        </div>
        <div>
          <p className="label text-banarasi mb-1">DESCRIPTION *</p>
          <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Meta ads spend — June 1–7"
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
        <div>
          <p className="label text-banarasi mb-1">AMOUNT (₹) *</p>
          <input type="number" step="0.01" value={form.amountRupees}
            onChange={e => setForm({ ...form, amountRupees: e.target.value })}
            placeholder="e.g. 5000"
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
        <div>
          <p className="label text-banarasi mb-1">GST (₹) <span className="text-mitti">— if claimable</span></p>
          <input type="number" step="0.01" value={form.gstRupees}
            onChange={e => setForm({ ...form, gstRupees: e.target.value })}
            placeholder="0"
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
        <div>
          <p className="label text-banarasi mb-1">INCURRED ON *</p>
          <input type="date" value={form.incurredOn} onChange={e => setForm({ ...form, incurredOn: e.target.value })}
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
        <div>
          <p className="label text-banarasi mb-1">PAID ON <span className="text-mitti">— leave blank if unpaid</span></p>
          <input type="date" value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })}
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
        <div className="md:col-span-2">
          <VendorAutocomplete
            vendorId={form.vendorId}
            vendorName={form.vendorNameSnapshot}
            onChange={({ vendorId, vendorName }) => setForm({ ...form, vendorId, vendorNameSnapshot: vendorName })}
          />
        </div>
        <div>
          <p className="label text-banarasi mb-1">INVOICE NUMBER</p>
          <input value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })}
            className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </div>
      </div>

      <div className="mt-4">
        <p className="label text-banarasi mb-1">RECEIPT / INVOICE</p>
        <MultiFileInput
          value={form.attachments}
          onChange={(urls) => setForm({ ...form, attachments: urls, receiptUrl: urls[0] || '' })}
          folder="finance-receipts"
          label="UPLOAD SUPPORTING FILES"
          helpText="Images (PNG/JPG/WebP), PDF, Excel, CSV — attach multiple"
          maxFiles={10}
        />
      </div>

      <div className="mt-4">
        <p className="label text-banarasi mb-1">NOTES</p>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
      </div>

      {err && <div className="mt-3 bg-madder/10 border border-madder p-3 text-sm text-madder">{err}</div>}

      <div className="mt-5 flex gap-2">
        <button onClick={() => { setForm({ ...form, status: 'submit' }); submit(); }} disabled={saving}
          className="bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
          {saving ? 'SAVING…' : 'SUBMIT EXPENSE'}
        </button>
        <button onClick={() => { setForm({ ...form, status: 'draft' }); submit(); }} disabled={saving}
          className="border border-kohl text-kohl px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
          SAVE AS DRAFT
        </button>
      </div>
    </div>
  );
}

// v23.40.2 — Modal to record a payment against an approved expense.
// Posts to /api/admin/finance/expenses/:id/payments and flows into the vendor ledger.
function PayExpenseModal({ expense, onClose, onPaid }: { expense: Expense; onClose: () => void; onPaid: () => void }) {
  const outstanding = expense.totalPaise - (expense.paidPaise || 0);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    amountRupees: (outstanding / 100).toFixed(2),
    paidOn: today,
    method: 'BANK_TRANSFER',
    reference: '',
    notes: '',
    attachments: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setSaving(true);
    try {
      const amt = Math.round(parseFloat(form.amountRupees) * 100);
      if (!amt || amt <= 0) throw new Error('Amount must be > 0');
      if (amt > outstanding) throw new Error(`Cannot exceed outstanding ₹${(outstanding/100).toLocaleString('en-IN')}`);
      const r = await fetch(`/api/admin/finance/expenses/${expense.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: amt,
          paidOn: form.paidOn,
          method: form.method,
          reference: form.reference || null,
          notes: form.notes || null,
          attachments: form.attachments,
          receiptUrl: form.attachments[0] || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to record payment');
      onPaid();
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-ivory max-w-lg w-full my-8 max-h-[calc(100vh-4rem)] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 pb-4 border-b border-mitti/10 sticky top-0 bg-ivory z-10">
          <div>
            <h3 className="font-display text-xl text-kohl">Record payment</h3>
            <p className="text-xs text-mitti mt-0.5">{expense.description}</p>
          </div>
          <button onClick={onClose} className="text-mitti hover:text-madder"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          <div className="bg-beige/50 p-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="label text-mitti">TOTAL</p>
              <p className="font-display text-kohl">{formatINR(expense.totalPaise)}</p>
            </div>
            <div>
              <p className="label text-mitti">PAID</p>
              <p className="font-display text-emerald-700">{formatINR(expense.paidPaise || 0)}</p>
            </div>
            <div>
              <p className="label text-mitti">OUTSTANDING</p>
              <p className="font-display text-madder">{formatINR(outstanding)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="label text-banarasi mb-1">AMOUNT (₹) *</p>
              <input type="number" step="0.01" value={form.amountRupees}
                onChange={e => setForm({ ...form, amountRupees: e.target.value })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
            </div>
            <div>
              <p className="label text-banarasi mb-1">PAID ON *</p>
              <input type="date" value={form.paidOn}
                onChange={e => setForm({ ...form, paidOn: e.target.value })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
            </div>
            <div>
              <p className="label text-banarasi mb-1">METHOD</p>
              <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm">
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="UPI">UPI</option>
                <option value="CHEQUE">Cheque</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="RAZORPAY_PAYOUT">Razorpay payout</option>
              </select>
            </div>
            <div>
              <p className="label text-banarasi mb-1">REFERENCE / UTR</p>
              <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}
                placeholder="UTR / Cheque #"
                className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
            </div>
          </div>

          <div>
            <p className="label text-banarasi mb-1">PAYMENT SUPPORTING FILES</p>
            <MultiFileInput
              value={form.attachments}
              onChange={(urls) => setForm({ ...form, attachments: urls })}
              folder="finance-expense-payments"
              label="ATTACH PROOF OF PAYMENT"
              helpText="Bank confirmation, UTR screenshot, cheque image, receipt — multiple files allowed"
              maxFiles={6}
            />
          </div>

          <div>
            <p className="label text-banarasi mb-1">NOTES</p>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full border border-mitti/30 px-3 py-2 bg-ivory text-sm" />
          </div>

          {err && <div className="bg-madder/10 border border-madder/30 text-madder text-xs p-2">{err}</div>}

          <p className="text-[10px] text-mitti">
            This payment will be recorded against the expense and will appear in the counterparty&apos;s vendor ledger
            {expense.vendorNameSnapshot ? ` (${expense.vendorNameSnapshot})` : ''}.
          </p>
        </div>

        <div className="flex gap-2 p-6 pt-4 border-t border-mitti/10 sticky bottom-0 bg-ivory">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'POSTING…' : 'POST PAYMENT'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}
