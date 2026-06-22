'use client';
// v23.40.6 — Seller portal: Commission invoices billed by NEEJEE.
// Shows two-way reconciliation: what NEEJEE has billed vs what seller has paid,
// plus an estimate of commission for orders not yet billed.
import { useEffect, useState } from 'react';
import { Receipt, AlertCircle, Clock, CheckCircle2, TrendingUp, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

function inr(p: number) { return '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }

export default function SellerCommissions() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/seller/commissions').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <p className="text-mitti">Loading…</p>;
  const s = data?.summary || {};
  const invoices = data?.invoices || [];

  return (
    <>
      <p className="label text-madder">RECONCILIATION</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Commission Invoices</h1>
      <p className="font-italic italic text-mitti mt-2">
        Every order NEEJEE delivers on your behalf carries a {s.commissionPct || 20}% commission.
        These invoices are auto-generated weekly so you always know what you owe — and what we&apos;ve already settled.
      </p>
      <div className="madder-divider mt-4"></div>

      {/* Summary tiles */}
      <div className="grid md:grid-cols-4 gap-4 mt-8">
        <Kpi
          label="Outstanding"
          value={inr(s.totalOutstandingPaise || 0)}
          hint={s.overdueCount > 0 ? `${s.overdueCount} overdue` : 'All clear'}
          accent={s.totalOutstandingPaise > 0}
          icon={AlertCircle}
        />
        <Kpi
          label="Total billed (lifetime)"
          value={inr(s.totalBilledPaise || 0)}
          hint={`${s.invoiceCount || 0} invoices`}
          icon={Receipt}
        />
        <Kpi
          label="Total paid"
          value={inr(s.totalPaidPaise || 0)}
          hint="Cleared by you"
          icon={CheckCircle2}
        />
        <Kpi
          label="Pending billing"
          value={inr(s.pendingCommissionEstPaise || 0)}
          hint={`${s.pendingItems || 0} item(s) · next run ${s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Mon 3:00 AM'}`}
          icon={Clock}
        />
      </div>

      {/* Pending orders banner */}
      {s.pendingItems > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">{s.pendingItems} delivered order line(s) pending commission billing.</p>
            <p className="text-xs mt-1">
              Estimated commission of {inr(s.pendingCommissionEstPaise)} (+ {s.commissionPct || 18}% GST) will be billed
              on the next auto-run. NEEJEE typically deducts commission from your payout, so you may not need to pay separately —
              check your <a className="underline" href="/seller/payouts">Payouts</a> page.
            </p>
          </div>
        </div>
      )}

      {/* Invoice list */}
      <div className="mt-12">
        <p className="label text-madder mb-3">INVOICE HISTORY</p>
        {invoices.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-mitti/30">
            <Receipt className="w-10 h-10 text-mitti/40 mx-auto mb-3" />
            <p className="text-mitti">No commission invoices yet. They are auto-generated weekly.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-mitti/20 text-left">
                  <th className="p-3 label text-mitti">INVOICE #</th>
                  <th className="p-3 label text-mitti">ISSUED</th>
                  <th className="p-3 label text-mitti">DUE</th>
                  <th className="p-3 label text-mitti text-right">COMMISSION + GST</th>
                  <th className="p-3 label text-mitti text-right">PAID</th>
                  <th className="p-3 label text-mitti text-right">OUTSTANDING</th>
                  <th className="p-3 label text-mitti text-center">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv: any) => {
                  const outstanding = inv.totalPaise - inv.paidPaise;
                  const overdue = inv.paymentStatus !== 'PAID' && inv.paymentStatus !== 'CANCELLED' && inv.dueOn && new Date(inv.dueOn) < new Date();
                  return (
                    <tr key={inv.id} className="border-b border-mitti/10 hover:bg-beige/30">
                      <td className="p-3 font-mono text-xs text-kohl">{inv.invoiceNumber}</td>
                      <td className="p-3 text-mitti text-sm">{new Date(inv.issuedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                      <td className={`p-3 text-sm ${overdue ? 'text-madder font-medium' : 'text-mitti'}`}>
                        {inv.dueOn ? new Date(inv.dueOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                      </td>
                      <td className="p-3 text-right tabular-nums text-kohl">{inr(inv.totalPaise)}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-700">{inv.paidPaise ? inr(inv.paidPaise) : '—'}</td>
                      <td className={`p-3 text-right tabular-nums font-medium ${outstanding > 0 ? 'text-madder' : 'text-mitti'}`}>
                        {outstanding !== 0 ? inr(outstanding) : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-0.5 text-[10px] tracking-widest ${
                          inv.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                          inv.paymentStatus === 'CANCELLED' ? 'bg-mitti/20 text-mitti' :
                          overdue ? 'bg-madder/10 text-madder' :
                          'bg-amber-100 text-amber-800'
                        }`}>{inv.paymentStatus.replace('_', ' ')}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-12 bg-beige/30 p-6 border border-mitti/10">
        <h3 className="font-display text-xl text-kohl mb-2 flex items-center gap-2">
          <Calendar className="w-5 h-5" /> How commission billing works
        </h3>
        <ul className="text-sm text-mitti space-y-1.5 list-disc list-inside mt-3">
          <li>Every Monday at 3:00 AM, NEEJEE generates one consolidated commission invoice for orders delivered the previous week.</li>
          <li>Commission is calculated as <b>{s.commissionPct || 20}%</b> of the order item value + applicable GST ({18}% on services).</li>
          <li>NEEJEE typically deducts commission directly from your next payout — you don&apos;t need to pay separately unless we tell you otherwise.</li>
          <li>If you have a dispute on any line item, message us via the <a className="underline" href="/seller/help">Help</a> page within 7 days.</li>
          <li>All invoices and payment records are immutable once posted — for transparency on both sides.</li>
        </ul>
      </div>
    </>
  );
}

function Kpi({ label, value, hint, accent, icon: Icon }: any) {
  return (
    <div className={`p-4 border ${accent ? 'border-madder/40 bg-madder/5' : 'border-mitti/20 bg-ivory'}`}>
      <p className="label text-mitti text-[10px] flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />} {label}
      </p>
      <p className={`font-display text-2xl mt-1 ${accent ? 'text-madder' : 'text-kohl'}`}>{value}</p>
      {hint && <p className="text-[10px] text-mitti mt-1">{hint}</p>}
    </div>
  );
}
