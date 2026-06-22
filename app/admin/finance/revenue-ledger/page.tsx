'use client';
// v23.40.5 — Revenue Ledger viewer with channel / saleType / type filters & GST summary.
import { useEffect, useState } from 'react';
import { Download, Loader2, Filter, TrendingUp, TrendingDown, Receipt } from 'lucide-react';
import { formatINR } from '@/lib/money';

const TYPE_LABEL: Record<string, string> = {
  PRODUCT_REVENUE:      'Product revenue',
  SHIPPING_REVENUE:     'Shipping revenue',
  GST_CGST_OUTPUT:      'CGST output',
  GST_SGST_OUTPUT:      'SGST output',
  GST_IGST_OUTPUT:      'IGST output',
  DISCOUNT:             'Discount',
  COGS:                 'COGS',
  COMMISSION_INCOME:    'Commission income',
  SELLER_PAYABLE:       'Seller payable',
  PAYMENT_GATEWAY_FEE:  'PG fees',
  COD_HANDLING_FEE:     'COD handling',
  REFUND_REVERSAL:      'Refund reversal',
};

export default function RevenueLedgerPage() {
  const startOfYear = `${new Date().getFullYear()}-01-01`;
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(startOfYear);
  const [to,   setTo]   = useState(today);
  const [channel, setChannel] = useState('');
  const [saleType, setSaleType] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const url = new URL('/api/admin/finance/revenue-ledger', window.location.origin);
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);
    if (channel)  url.searchParams.set('channel', channel);
    if (saleType) url.searchParams.set('saleType', saleType);
    if (type)     url.searchParams.set('type', type);
    if (status)   url.searchParams.set('status', status);
    const r = await fetch(url.toString());
    const d = await r.json();
    setData(d);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function exportCsv() {
    if (!data) return;
    const header = ['Date','Ledger','Channel','SaleType','Status','Customer','Seller','Amount','CGST','SGST','IGST','InvoiceId','OrderId'];
    const lines = [header.join(',')];
    for (const e of data.entries) {
      lines.push([
        new Date(e.txnDate).toISOString().slice(0, 10),
        TYPE_LABEL[e.type] || e.type,
        e.channel, e.saleType, e.status,
        `"${(e.customerName || '').replace(/"/g, '""')}"`,
        e.sellerId || '',
        (e.amountPaise / 100).toFixed(2),
        (e.cgstPaise / 100).toFixed(2),
        (e.sgstPaise / 100).toFixed(2),
        (e.igstPaise / 100).toFixed(2),
        e.invoiceId || '',
        e.orderId || '',
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `revenue-ledger-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Revenue Ledger</h1>
          <p className="text-mitti text-sm mt-1">
            Every revenue posting: product sales, GST output, discounts, COGS, commissions, seller payables.
          </p>
        </div>
        <button onClick={exportCsv} disabled={!data}
          className="flex items-center gap-1 px-3 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50">
          <Download className="w-3 h-3" /> EXPORT CSV
        </button>
      </div>

      {/* Summary tiles */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Tile label="Net (income)" value={formatINR(data.summary.netPaise)} icon={TrendingUp} good />
          <Tile label="Realized revenue" value={formatINR(data.summary.realizedRevenuePaise)} />
          <Tile label="Accrued (not yet paid)" value={formatINR(data.summary.accruedRevenuePaise)} muted />
          <Tile label="GST output (CGST+SGST+IGST)" value={formatINR(data.summary.gstTotalOutputPaise)} icon={Receipt} muted />
        </div>
      )}

      {/* By-type breakdown */}
      {data && Object.keys(data.summary.byType || {}).length > 0 && (
        <div className="bg-ivory border border-mitti/20 p-4 mb-4">
          <p className="label text-mitti text-[10px] mb-2">BY LEDGER</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {Object.entries(data.summary.byType).sort((a: any, b: any) => Math.abs(b[1]) - Math.abs(a[1])).map(([t, amt]: any) => (
              <div key={t} className="flex justify-between p-2 bg-beige/40">
                <span className="text-mitti">{TYPE_LABEL[t] || t}</span>
                <span className={`tabular-nums font-medium ${amt > 0 ? 'text-emerald-700' : amt < 0 ? 'text-madder' : 'text-mitti'}`}>
                  {formatINR(amt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel × SaleType split */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <SplitTile title="By Channel" map={data.summary.byChannel} />
          <SplitTile title="By Sale Type" map={data.summary.bySaleType} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-ivory border border-mitti/20 p-4 mb-4">
        <p className="label text-mitti text-[10px] mb-2 flex items-center gap-1"><Filter className="w-3 h-3" /> FILTERS</p>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <div>
            <p className="label text-banarasi mb-1 text-[10px]">FROM</p>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="w-full border border-mitti/30 px-2 py-1 bg-ivory text-xs" />
          </div>
          <div>
            <p className="label text-banarasi mb-1 text-[10px]">TO</p>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="w-full border border-mitti/30 px-2 py-1 bg-ivory text-xs" />
          </div>
          <div>
            <p className="label text-banarasi mb-1 text-[10px]">CHANNEL</p>
            <select value={channel} onChange={e => setChannel(e.target.value)}
              className="w-full border border-mitti/30 px-2 py-1 bg-ivory text-xs">
              <option value="">All</option>
              <option value="WEBSITE">Website</option>
              <option value="POS">POS</option>
              <option value="BULK">Bulk</option>
              <option value="MARKETPLACE">Marketplace</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="MARKETPLACE_COMMISSION">Commission</option>
            </select>
          </div>
          <div>
            <p className="label text-banarasi mb-1 text-[10px]">SALE TYPE</p>
            <select value={saleType} onChange={e => setSaleType(e.target.value)}
              className="w-full border border-mitti/30 px-2 py-1 bg-ivory text-xs">
              <option value="">All</option>
              <option value="DIRECT">Direct</option>
              <option value="MARKETPLACE">Marketplace</option>
            </select>
          </div>
          <div>
            <p className="label text-banarasi mb-1 text-[10px]">LEDGER</p>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full border border-mitti/30 px-2 py-1 bg-ivory text-xs">
              <option value="">All</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <p className="label text-banarasi mb-1 text-[10px]">STATUS</p>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-mitti/30 px-2 py-1 bg-ivory text-xs">
              <option value="">All</option>
              <option value="ACCRUED">Accrued</option>
              <option value="REALIZED">Realized</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="mt-3 px-4 py-2 bg-kohl text-ivory text-xs tracking-widest disabled:opacity-50">
          {loading ? 'LOADING…' : 'APPLY FILTERS'}
        </button>
      </div>

      {/* Entries */}
      {loading || !data ? (
        <div className="flex items-center justify-center py-12 text-mitti">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : data.entries.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti">
          No revenue entries in this period. Sales invoices automatically post here.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 overflow-x-auto">
          <table className="w-full font-ui text-sm min-w-[900px]">
            <thead className="bg-beige/60 text-mitti text-xs label">
              <tr>
                <th className="text-left p-2">DATE</th>
                <th className="text-left p-2">LEDGER</th>
                <th className="text-left p-2">CHANNEL</th>
                <th className="text-left p-2">CUSTOMER</th>
                <th className="text-left p-2">STATUS</th>
                <th className="text-right p-2">AMOUNT</th>
                <th className="text-right p-2">CGST</th>
                <th className="text-right p-2">SGST</th>
                <th className="text-right p-2">IGST</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e: any) => (
                <tr key={e.id} className="border-t border-mitti/10 hover:bg-beige/30">
                  <td className="p-2 text-mitti whitespace-nowrap">{new Date(e.txnDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</td>
                  <td className="p-2 text-kohl">{TYPE_LABEL[e.type] || e.type}</td>
                  <td className="p-2 text-mitti text-xs">{e.channel} · {e.saleType}</td>
                  <td className="p-2 text-mitti text-xs">{e.customerName || '—'}</td>
                  <td className="p-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] tracking-widest ${
                      e.status === 'REALIZED' ? 'bg-emerald-100 text-emerald-800' :
                      e.status === 'REVERSED' ? 'bg-madder/10 text-madder'        :
                                                'bg-amber-100 text-amber-800'
                    }`}>{e.status}</span>
                  </td>
                  <td className={`p-2 text-right tabular-nums ${e.amountPaise > 0 ? 'text-emerald-700' : 'text-madder'}`}>
                    {formatINR(e.amountPaise)}
                  </td>
                  <td className="p-2 text-right tabular-nums text-mitti text-xs">{e.cgstPaise ? formatINR(e.cgstPaise) : '—'}</td>
                  <td className="p-2 text-right tabular-nums text-mitti text-xs">{e.sgstPaise ? formatINR(e.sgstPaise) : '—'}</td>
                  <td className="p-2 text-right tabular-nums text-mitti text-xs">{e.igstPaise ? formatINR(e.igstPaise) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, icon: Icon, good, muted }: any) {
  return (
    <div className={`p-4 border ${
      good  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
      muted ? 'bg-ivory border-mitti/20 text-mitti' :
              'bg-ivory border-mitti/20 text-kohl'
    }`}>
      <p className="label text-[10px] flex items-center gap-1">{Icon && <Icon className="w-3 h-3" />} {label}</p>
      <p className="font-display text-xl mt-1">{value}</p>
    </div>
  );
}
function SplitTile({ title, map }: { title: string; map: Record<string, number> }) {
  const entries = Object.entries(map || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div className="bg-ivory border border-mitti/20 p-4">
      <p className="label text-mitti text-[10px] mb-2">{title}</p>
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <span className="text-mitti">{k}</span>
            <span className={`tabular-nums font-medium ${v > 0 ? 'text-emerald-700' : v < 0 ? 'text-madder' : 'text-mitti'}`}>
              {formatINR(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
