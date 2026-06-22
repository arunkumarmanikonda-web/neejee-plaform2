'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Building, ChevronRight, RefreshCw } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface BankAccount {
  id: string;
  nickname: string;
  bankName: string;
  accountNumber?: string | null;
  accountType?: string | null;
  active: boolean;
  openingBalancePaise: number;
  lastSyncedAt?: string | null;
  stats: {
    unmatched: number;
    autoMatched: number;
    manualMatched: number;
    ignored: number;
    draft: number;
  };
}

export default function BankReconciliationPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch('/api/admin/finance/bank-accounts');
    const d = await r.json();
    setAccounts(d.accounts || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Bank Reconciliation</h1>
          <p className="text-mitti text-sm mt-1">Match bank statements with bills, payments, and orders.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1 px-3 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
          <Plus className="w-3 h-3" /> NEW ACCOUNT
        </button>
      </div>

      {showNew && <NewAccountForm onSaved={() => { setShowNew(false); load(); }} onClose={() => setShowNew(false)} />}

      {loading ? (
        <p className="text-mitti">Loading…</p>
      ) : accounts.length === 0 ? (
        <div className="bg-beige p-12 text-center">
          <Building className="w-12 h-12 text-mitti/40 mx-auto mb-3" />
          <p className="text-mitti">No bank accounts configured yet.</p>
          <p className="text-mitti text-xs mt-2">Click "NEW ACCOUNT" to add HDFC or RazorpayX.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {accounts.map(a => (
            <Link key={a.id} href={`/admin/finance/bank-reconciliation/${a.id}`}
              className="bg-white border border-mitti/10 hover:border-madder p-5 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-beige flex items-center justify-center">
                  <Building className="w-6 h-6 text-kohl" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-kohl">{a.nickname}</span>
                    <span className="text-[10px] uppercase tracking-wider bg-beige px-2 py-0.5">{a.bankName}</span>
                    {!a.active && <span className="text-[10px] uppercase tracking-wider bg-mitti/20 px-2 py-0.5">INACTIVE</span>}
                  </div>
                  <p className="text-xs text-mitti mt-1">
                    {a.accountNumber && `••••${a.accountNumber.slice(-4)} · `}
                    {a.accountType || '—'}
                    {a.lastSyncedAt && ` · Last synced ${new Date(a.lastSyncedAt).toLocaleDateString('en-IN')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <div className="text-mitti">Unmatched</div>
                  <div className={`font-display text-xl ${a.stats.unmatched > 0 ? 'text-madder' : 'text-kohl'}`}>
                    {a.stats.unmatched}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-mitti">Auto matched</div>
                  <div className="font-display text-xl text-green-700">{a.stats.autoMatched}</div>
                </div>
                <div className="text-right">
                  <div className="text-mitti">Manual</div>
                  <div className="font-display text-xl text-kohl">{a.stats.manualMatched}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-mitti group-hover:text-madder" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewAccountForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({
    nickname: '', bankName: 'HDFC', accountNumber: '', ifsc: '', accountType: 'CURRENT',
    openingBalanceRupees: '', openingBalanceDate: '', rzpxAccountId: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr(''); setSaving(true);
    try {
      const r = await fetch('/api/admin/finance/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      onSaved();
    } catch (e: any) {
      setErr(e.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-kohl/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-ivory max-w-md w-full p-6">
        <h3 className="font-display text-xl text-kohl mb-4">Add bank account</h3>
        <div className="space-y-3">
          <Field label="NICKNAME *" value={form.nickname} onChange={v => setForm({ ...form, nickname: v })} placeholder="HDFC Current — Main" />
          <div>
            <p className="label text-banarasi mb-1">BANK *</p>
            <select value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory">
              <option value="HDFC">HDFC</option>
              <option value="RAZORPAYX">RazorpayX</option>
              <option value="ICICI">ICICI</option>
              <option value="AXIS">Axis</option>
              <option value="SBI">SBI</option>
              <option value="KOTAK">Kotak</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <Field label="ACCOUNT NUMBER (last 4)" value={form.accountNumber} onChange={v => setForm({ ...form, accountNumber: v })} />
          <Field label="IFSC" value={form.ifsc} onChange={v => setForm({ ...form, ifsc: v })} />
          <div>
            <p className="label text-banarasi mb-1">TYPE</p>
            <select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory">
              <option value="CURRENT">Current</option>
              <option value="SAVINGS">Savings</option>
              <option value="VIRTUAL">Virtual (RazorpayX)</option>
            </select>
          </div>
          <Field label="OPENING BALANCE (₹)" type="number" value={form.openingBalanceRupees} onChange={v => setForm({ ...form, openingBalanceRupees: v })} />
          <Field label="OPENING BALANCE DATE" type="date" value={form.openingBalanceDate} onChange={v => setForm({ ...form, openingBalanceDate: v })} />
          {form.bankName === 'RAZORPAYX' && (
            <Field label="RAZORPAYX ACCOUNT ID" value={form.rzpxAccountId} onChange={v => setForm({ ...form, rzpxAccountId: v })} placeholder="acc_xxx" />
          )}
        </div>
        {err && <p className="mt-3 text-madder text-xs">{err}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-kohl text-ivory px-4 py-2 text-xs tracking-widest disabled:opacity-50">
            {saving ? 'SAVING…' : 'CREATE'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest">
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
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
    </div>
  );
}
