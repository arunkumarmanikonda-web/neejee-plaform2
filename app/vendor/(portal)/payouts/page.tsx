'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Wallet, CheckCircle2, Clock, XCircle, IndianRupee } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function VendorPayoutsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vendor/payouts', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;
  if (!data) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8 space-y-5">
      <header>
        <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
          <Wallet className="w-6 h-6 text-madder" /> Payouts
        </h1>
        <p className="text-sm text-mitti mt-1">Track payments NEEJEE has made to you and what's still outstanding.</p>
      </header>

      {/* Outstanding */}
      {data.outstanding && data.outstanding.totalPaise > 0 ? (
        <section className="bg-madder/5 border border-madder/30 p-5">
          <p className="text-[10px] uppercase tracking-[0.3em] text-madder mb-1">Outstanding to you</p>
          <p className="font-display text-3xl text-kohl">{formatINR(data.outstanding.totalPaise)}</p>
          <p className="text-xs text-mitti mt-1">Across {data.outstanding.poCount} purchase order{data.outstanding.poCount > 1 ? 's' : ''}.</p>
          {data.outstanding.pos?.length > 0 && (
            <ul className="mt-3 text-xs space-y-1">
              {data.outstanding.pos.map((po: any) => (
                <li key={po.id} className="flex justify-between border-t border-madder/15 py-1">
                  <Link href={`/vendor/purchase-orders/${po.id}`} className="font-mono text-madder hover:underline">{po.poNumber}</Link>
                  <span className="font-mono">{formatINR(po.totalPaise)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="bg-ivory border border-mitti/15 p-5 text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto text-green-600 mb-2" />
          <p className="font-display text-lg text-kohl">All settled</p>
          <p className="text-xs text-mitti">No outstanding amount right now.</p>
        </section>
      )}

      {/* Payout history */}
      <section className="bg-ivory border border-mitti/15">
        <div className="px-5 py-3 border-b border-mitti/15">
          <h2 className="font-display text-lg text-kohl">Payment history</h2>
        </div>
        {(!data.payouts || data.payouts.length === 0) ? (
          <div className="p-10 text-center">
            <IndianRupee className="w-10 h-10 mx-auto text-mitti/40 mb-3" />
            <p className="font-display text-lg text-kohl">No payouts yet</p>
            <p className="text-xs text-mitti mt-2 max-w-md mx-auto">
              When NEEJEE wires payment to you, the record will appear here with date, amount, TDS deducted, and UTR.
              For now, payouts are processed by our finance team after PO receipt.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-beige text-[10px] uppercase tracking-widest text-mitti">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Gross</th>
                <th className="text-right p-3">TDS</th>
                <th className="text-right p-3">Net</th>
                <th className="text-left p-3">UTR / Ref</th>
              </tr>
            </thead>
            <tbody>
              {data.payouts.map((p: any) => (
                <tr key={p.id} className="border-t border-mitti/10">
                  <td className="p-3 text-xs">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : p.scheduledFor ? `Sched: ${new Date(p.scheduledFor).toLocaleDateString()}` : '—'}</td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3 text-right font-mono">{formatINR(p.grossPaise)}</td>
                  <td className="p-3 text-right font-mono text-mitti">{p.tdsPaise > 0 ? `-${formatINR(p.tdsPaise)}` : '—'}</td>
                  <td className="p-3 text-right font-mono font-bold">{formatINR(p.netPaise)}</td>
                  <td className="p-3 text-xs font-mono">{p.transactionRef || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-ivory border border-mitti/15 p-5 text-xs text-mitti">
        <p className="font-display text-sm text-kohl uppercase tracking-wider mb-2">TDS Certificates</p>
        <p>NEEJEE deducts TDS as per Sections 194Q / 194C. Form 16A certificates are issued quarterly. They will appear here in a future release; until then, ping us at <a href="mailto:partners@neejee.com" className="text-madder">partners@neejee.com</a>.</p>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { c: string; bg: string; Icon: any }> = {
    PAID:       { c: 'text-green-800', bg: 'bg-green-100', Icon: CheckCircle2 },
    SCHEDULED:  { c: 'text-mitti', bg: 'bg-haldi/20', Icon: Clock },
    PROCESSING: { c: 'text-mitti', bg: 'bg-haldi/20', Icon: Clock },
    FAILED:     { c: 'text-madder', bg: 'bg-madder/10', Icon: XCircle },
    CANCELLED:  { c: 'text-mitti', bg: 'bg-mitti/15', Icon: XCircle },
  };
  const s = styles[status] || styles.SCHEDULED;
  const Icon = s.Icon;
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 ${s.c} ${s.bg}`}><Icon className="w-3 h-3" /> {status}</span>;
}
