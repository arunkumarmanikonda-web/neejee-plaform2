'use client';
import { useEffect, useState } from 'react';
import { Loader2, Printer, Download } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function AgingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/admin/finance/aging');
      const j = await r.json();
      setData(j);
      setLoading(false);
    })();
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows: string[][] = [
      ['NEEJEE — AP/AR Aging Report'],
      ['Generated', new Date(data.generatedAt).toLocaleString('en-IN')],
      [],
      ['── ACCOUNTS PAYABLE ──'],
      ['Bucket', 'Bill count', 'Outstanding (₹)'],
    ];
    if (data.ap) {
      for (const b of data.ap.buckets) {
        rows.push([b.label, String(b.count), (b.outstandingPaise / 100).toFixed(2)]);
      }
      rows.push(['TOTAL', String(data.ap.buckets.reduce((s: number, b: any) => s + b.count, 0)), (data.ap.totalOutstandingPaise / 100).toFixed(2)]);
      rows.push([]);
      rows.push(['── BY VENDOR ──']);
      rows.push(['Vendor', 'Bills', 'Outstanding (₹)']);
      for (const v of data.ap.byVendor) {
        rows.push([v.vendorName, String(v.billCount), (v.outstandingPaise / 100).toFixed(2)]);
      }
    }
    if (data.ar) {
      rows.push([]);
      rows.push(['── ACCOUNTS RECEIVABLE ──']);
      rows.push(['Bucket', 'Order count', 'Outstanding (₹)']);
      for (const b of data.ar.buckets) {
        rows.push([b.label, String(b.count), (b.outstandingPaise / 100).toFixed(2)]);
      }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neejee-aging-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-mitti py-12 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;
  if (!data) return <div>No data</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display text-2xl text-kohl">AP / AR Aging</h2>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="border border-kohl text-kohl px-4 py-2 font-ui text-xs tracking-widest flex items-center gap-2">
            <Download className="w-3 h-3" /> EXPORT CSV
          </button>
          <button onClick={() => window.print()} className="border border-kohl text-kohl px-4 py-2 font-ui text-xs tracking-widest flex items-center gap-2">
            <Printer className="w-3 h-3" /> PRINT
          </button>
        </div>
      </div>
      <p className="text-mitti text-sm">As of {new Date(data.generatedAt).toLocaleString('en-IN')}</p>

      {/* AP */}
      {data.ap && (
        <section className="bg-ivory border border-mitti/20 p-6 rounded">
          <h3 className="font-display text-xl text-kohl mb-3">Accounts Payable</h3>
          <p className="text-mitti text-xs mb-4">What we owe vendors and counterparties</p>

          <div className="grid grid-cols-5 gap-3 mb-6">
            {data.ap.buckets.map((b: any) => (
              <div key={b.bucket} className={`p-3 rounded text-center ${
                b.bucket === '90_PLUS' ? 'bg-madder/15' :
                b.bucket === '61_90' ? 'bg-madder/8' :
                b.bucket === '31_60' ? 'bg-banarasi/15' :
                b.bucket === '1_30' ? 'bg-banarasi/8' :
                'bg-beige/40'
              }`}>
                <p className="label text-mitti text-[10px]">{b.label}</p>
                <p className="font-display text-lg text-kohl mt-1">{formatINR(b.outstandingPaise)}</p>
                <p className="text-mitti text-xs">{b.count} bill{b.count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>

          <p className="font-display text-2xl text-kohl border-t border-mitti/20 pt-3 text-right">
            Total: {formatINR(data.ap.totalOutstandingPaise)}
          </p>

          {data.ap.byVendor.length > 0 && (
            <div className="mt-6">
              <h4 className="font-display text-lg text-kohl mb-2">By vendor</h4>
              <table className="w-full font-ui text-sm">
                <thead className="text-mitti text-xs label">
                  <tr className="border-b border-mitti/20">
                    <th className="text-left p-2">VENDOR</th>
                    <th className="text-right p-2">BILLS</th>
                    <th className="text-right p-2">OUTSTANDING</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ap.byVendor.map((v: any, i: number) => (
                    <tr key={i} className="border-b border-mitti/10">
                      <td className="p-2 text-kohl">{v.vendorName}</td>
                      <td className="p-2 text-right text-mitti">{v.billCount}</td>
                      <td className="p-2 text-right tabular-nums text-kohl">{formatINR(v.outstandingPaise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* AR */}
      {data.ar && (
        <section className="bg-ivory border border-mitti/20 p-6 rounded">
          <h3 className="font-display text-xl text-kohl mb-3">Accounts Receivable</h3>
          <p className="text-mitti text-xs mb-4">Orders placed but payment still pending (COD / B2B invoices)</p>

          <div className="grid grid-cols-5 gap-3">
            {data.ar.buckets.map((b: any) => (
              <div key={b.bucket} className={`p-3 rounded text-center ${
                b.bucket === '90_PLUS' ? 'bg-madder/15' :
                b.bucket === '61_90' ? 'bg-madder/8' :
                b.bucket === '31_60' ? 'bg-banarasi/15' :
                b.bucket === '1_30' ? 'bg-banarasi/8' :
                'bg-beige/40'
              }`}>
                <p className="label text-mitti text-[10px]">{b.label}</p>
                <p className="font-display text-lg text-kohl mt-1">{formatINR(b.outstandingPaise)}</p>
                <p className="text-mitti text-xs">{b.count} order{b.count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>

          <p className="font-display text-2xl text-kohl border-t border-mitti/20 pt-3 mt-4 text-right">
            Total: {formatINR(data.ar.totalOutstandingPaise)}
          </p>
        </section>
      )}
    </div>
  );
}
