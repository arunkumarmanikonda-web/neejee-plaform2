'use client';

import { useEffect, useState } from 'react';
import { Plus, Send, RefreshCw, Trash2, X, Loader2, Ban } from 'lucide-react';
import { formatINR, rupeesToPaise } from '@/lib/money';

interface SPayout {
  id: string;
  sellerId: string;
  periodStart: string;
  periodEnd: string;
  grossSales: number;
  commissionPaise: number;
  netPayoutPaise: number;
  orderCount: number;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'ON_HOLD';
  utr: string | null;
  rzpxPayoutId: string | null;
  rzpxStatus: string | null;
  rzpxFailReason: string | null;
  notes: string | null;
  createdAt: string;
  seller: {
    id: string;
    businessName: string | null;
    contactName: string | null;
    email: string | null;
    bankAccount: string | null;
    ifsc: string | null;
    rzpxFundAccountId: string | null;
  };
}

const STATUS_COLOURS: Record<string, string> = {
  PENDING:    'bg-mitti/15 text-mitti',
  PROCESSING: 'bg-haldi/20 text-haldi',
  PAID:       'bg-emerald-100 text-emerald-700',
  ON_HOLD:    'bg-madder/20 text-madder',
};

export default function SellerPayoutsPage() {
  const [payouts, setPayouts] = useState<SPayout[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true); setError('');
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/finance/seller-payouts', { credentials: 'include' }),
        fetch('/api/admin/sellers', { credentials: 'include' }),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      if (!r1.ok) throw new Error(d1.error || 'Load failed');
      setPayouts(d1.payouts || []);
      setSellers(d2.sellers || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, body: any) {
    setBusy(p => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/admin/finance/seller-payouts/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error || 'Action failed'); return; }
      await load();
    } finally { setBusy(p => ({ ...p, [id]: false })); }
  }

  async function remove(id: string) {
    if (!confirm('Delete this payout row?')) return;
    const res = await fetch(`/api/admin/finance/seller-payouts/${id}`, { method: 'DELETE', credentials: 'include' });
    const d = await res.json();
    if (!res.ok) { alert(d.error || 'Delete failed'); return; }
    await load();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="label text-madder">FINANCE · SELLER PAYOUTS</p>
          <h1 className="font-display text-3xl text-kohl">Seller payouts (RazorpayX)</h1>
          <p className="font-italic italic text-mitti mt-1">Net = gross sales − NEEJEE commission.</p>
        </div>
        <button onClick={() => setCreating(true)} className="bg-madder text-ivory px-4 py-2 font-ui text-xs tracking-widest hover:bg-kohl inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW PAYOUT
        </button>
      </div>

      {error && <div className="border border-madder bg-madder/10 text-madder p-3 mb-4 font-ui text-sm">{error}</div>}

      {loading ? <p className="italic text-mitti">Loading…</p> : (
        <div className="space-y-2">
          {payouts.length === 0 && (<div className="border border-mitti/20 bg-beige p-8 text-center text-mitti">No payouts yet.</div>)}
          {payouts.map(p => (
            <div key={p.id} className="border border-mitti/20 bg-ivory p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-ui tracking-widest px-2 py-0.5 ${STATUS_COLOURS[p.status]}`}>{p.status}</span>
                    {p.rzpxStatus && <span className="text-[10px] text-mitti font-mono">rzpx: {p.rzpxStatus}</span>}
                  </div>
                  <p className="font-display text-kohl">{p.seller?.businessName || p.seller?.contactName || 'Unknown seller'}</p>
                  <p className="text-[11px] text-mitti">
                    {new Date(p.periodStart).toLocaleDateString()} → {new Date(p.periodEnd).toLocaleDateString()} · {p.orderCount} order(s)
                  </p>
                  <p className="text-[11px] text-mitti">
                    {p.seller?.bankAccount ? `Acct …${p.seller.bankAccount.slice(-4)}` : 'No bank'}
                    {p.seller?.ifsc ? ` · ${p.seller.ifsc}` : ''}
                    {p.seller?.rzpxFundAccountId ? ' · ✓ RazorpayX cached' : ''}
                  </p>
                  {p.rzpxFailReason && <p className="text-xs text-madder mt-1">⚠ {p.rzpxFailReason}</p>}
                  {p.notes && <p className="text-xs text-mitti italic mt-1">{p.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-display text-lg text-kohl">{formatINR(p.netPayoutPaise)}</p>
                  <p className="text-[11px] text-mitti">gross {formatINR(p.grossSales)} − comm {formatINR(p.commissionPaise)}</p>
                  {p.utr && <p className="text-[10px] text-mitti font-mono">{p.utr}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  {p.status === 'PENDING' && (
                    <>
                      <button onClick={() => act(p.id, { action: 'initiate' })} disabled={busy[p.id]}
                        className="bg-madder text-ivory text-[10px] tracking-widest px-3 py-1 hover:bg-kohl disabled:opacity-50 inline-flex items-center gap-1">
                        {busy[p.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} INITIATE
                      </button>
                      <button onClick={() => act(p.id, { action: 'cancel' })} disabled={busy[p.id]}
                        className="border border-stone-400 text-stone-700 text-[10px] tracking-widest px-3 py-1 hover:bg-stone-200 disabled:opacity-50 inline-flex items-center gap-1">
                        <Ban className="w-3 h-3" /> HOLD
                      </button>
                    </>
                  )}
                  {p.rzpxPayoutId && (
                    <button onClick={() => act(p.id, { action: 'sync' })} disabled={busy[p.id]}
                      className="border border-kohl text-kohl text-[10px] tracking-widest px-3 py-1 hover:bg-kohl hover:text-ivory disabled:opacity-50 inline-flex items-center gap-1">
                      {busy[p.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} SYNC STATUS
                    </button>
                  )}
                  {(p.status === 'PENDING' || p.status === 'ON_HOLD') && (
                    <button onClick={() => remove(p.id)} className="text-monsoon hover:text-madder p-1 self-end" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (<NewModal sellers={sellers} onClose={() => setCreating(false)} onCreated={async () => { setCreating(false); await load(); }} />)}
    </div>
  );
}

function NewModal({ sellers, onClose, onCreated }: { sellers: any[]; onClose: () => void; onCreated: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [v, setV] = useState({ sellerId: '', grossRs: 0, commissionRs: 0, orderCount: 0, periodStart: lastMonth, periodEnd: today, notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const netRs = Math.max(0, (parseInt(String(v.grossRs)) || 0) - (parseInt(String(v.commissionRs)) || 0));

  const submit = async () => {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/finance/seller-payouts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          sellerId: v.sellerId,
          grossSales:      rupeesToPaise(String(v.grossRs)),
          commissionPaise: rupeesToPaise(String(v.commissionRs)),
          netPayoutPaise:  rupeesToPaise(String(netRs)),
          orderCount: v.orderCount, periodStart: v.periodStart, periodEnd: v.periodEnd,
          notes: v.notes || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Create failed');
      onCreated();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-ivory border border-mitti/30 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-kohl">New seller payout</h2>
          <button onClick={onClose} className="text-mitti hover:text-kohl"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="border border-madder bg-madder/10 text-madder p-2 mb-3 text-sm">{error}</div>}
        <div className="space-y-3">
          <div>
            <label className="label text-mitti">Seller *</label>
            <select value={v.sellerId} onChange={e => setV({ ...v, sellerId: e.target.value })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1">
              <option value="">— Select —</option>
              {sellers.map((s: any) => (<option key={s.id} value={s.id}>{s.businessName || s.contactName}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label text-mitti">Period start</label><input type="date" value={v.periodStart} onChange={e => setV({ ...v, periodStart: e.target.value })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1" /></div>
            <div><label className="label text-mitti">Period end</label><input type="date" value={v.periodEnd} onChange={e => setV({ ...v, periodEnd: e.target.value })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label text-mitti">Gross (₹)</label><input type="number" value={v.grossRs} onChange={e => setV({ ...v, grossRs: parseInt(e.target.value) || 0 })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1" /></div>
            <div><label className="label text-mitti">Commission (₹)</label><input type="number" value={v.commissionRs} onChange={e => setV({ ...v, commissionRs: parseInt(e.target.value) || 0 })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1" /></div>
            <div><label className="label text-mitti">Orders</label><input type="number" value={v.orderCount} onChange={e => setV({ ...v, orderCount: parseInt(e.target.value) || 0 })} className="w-full p-2 bg-ivory border border-mitti/20 mt-1" /></div>
          </div>
          <div className="bg-beige p-3 text-sm">Net to seller: <strong className="text-kohl">₹{netRs.toLocaleString('en-IN')}</strong></div>
          <div><label className="label text-mitti">Notes</label><textarea value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} rows={2} className="w-full p-2 bg-ivory border border-mitti/20 mt-1 text-sm" /></div>
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-mitti/15">
          <button onClick={submit} disabled={saving || !v.sellerId || netRs <= 0} className="flex-1 bg-kohl text-ivory text-xs tracking-widest px-4 py-2 hover:bg-madder disabled:opacity-40 inline-flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} CREATE (PENDING)
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-mitti/30 text-mitti text-xs tracking-widest hover:bg-mitti/10">Cancel</button>
        </div>
      </div>
    </div>
  );
}
