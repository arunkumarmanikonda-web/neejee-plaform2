'use client';
// v23.40.5 — Sales Invoice detail + revenue ledger breakup viewer.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Wallet, AlertCircle, CheckCircle2, FileText, Download } from 'lucide-react';
import { formatINR } from '@/lib/money';

const TYPE_LABEL: Record<string, string> = {
  PRODUCT_REVENUE:      'Product revenue',
  SHIPPING_REVENUE:     'Shipping revenue',
  GST_CGST_OUTPUT:      'CGST output',
  GST_SGST_OUTPUT:      'SGST output',
  GST_IGST_OUTPUT:      'IGST output',
  DISCOUNT:             'Discount',
  COGS:                 'Cost of goods sold',
  COMMISSION_INCOME:    'Commission income',
  SELLER_PAYABLE:       'Seller payable',
  PAYMENT_GATEWAY_FEE:  'Payment gateway fee',
  COD_HANDLING_FEE:     'COD handling fee',
  REFUND_REVERSAL:      'Refund reversal',
};

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/admin/finance/sales-invoices/${params.id}`);
    const d = await r.json();
    setData(d);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [params.id]);

  async function patch(body: any) {
    setBusy(true); setMsg('');
    try {
      const r = await fetch(`/api/admin/finance/sales-invoices/${params.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setMsg('Saved.');
      load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  if (loading || !data) return <div className="p-8">Loading…</div>;
  const inv = data.invoice;
  const entries = data.revenueEntries || [];

  return (
    <div className="p-8 max-w-6xl mx-auto print:p-0 print:max-w-none">
      <div className="print:hidden">
        <Link href="/admin/finance/sales-invoices" className="text-xs text-mitti hover:text-madder flex items-center gap-1 mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to invoices
        </Link>
      </div>

      {/* Invoice header card */}
      <div className="bg-white border border-mitti/20 p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display text-3xl text-kohl">Tax Invoice</h1>
            <p className="text-mitti text-sm mt-1">{inv.invoiceNumber}</p>
            <p className="text-mitti text-xs">{inv.invoiceType} · {inv.saleChannel} · {inv.saleType === 'DIRECT' ? 'Neejee direct' : 'Marketplace'}</p>
          </div>
          <div className="text-right">
            <p className={`inline-block px-3 py-1 text-xs uppercase ${
              inv.paymentStatus === 'PAID'      ? 'bg-emerald-100 text-emerald-800' :
              inv.paymentStatus === 'CANCELLED' ? 'bg-madder/10 text-madder'        :
                                                  'bg-amber-100 text-amber-800'
            }`}>{inv.paymentStatus.replace('_', ' ')}</p>
            <p className="text-mitti text-xs mt-2">Issued {new Date(inv.issuedOn).toLocaleDateString('en-IN')}</p>
            {inv.dueOn && <p className="text-mitti text-xs">Due {new Date(inv.dueOn).toLocaleDateString('en-IN')}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div className="bg-beige/40 p-3">
            <p className="label text-mitti text-[10px]">BILL TO</p>
            <p className="text-kohl font-medium">{inv.customerName}</p>
            {inv.customerEmail && <p className="text-mitti text-xs">{inv.customerEmail}</p>}
            {inv.customerPhone && <p className="text-mitti text-xs">{inv.customerPhone}</p>}
            {inv.customerGstin && <p className="text-mitti text-xs">GSTIN: {inv.customerGstin}</p>}
            {inv.billingAddress && <p className="text-mitti text-xs whitespace-pre-wrap mt-1">{inv.billingAddress}</p>}
          </div>
          <div className="bg-beige/40 p-3">
            <p className="label text-mitti text-[10px]">SHIP TO</p>
            <p className="text-mitti text-xs whitespace-pre-wrap">{inv.shippingAddress || inv.billingAddress || '—'}</p>
            {inv.placeOfSupply && <p className="text-mitti text-xs mt-1">Place of supply: {inv.placeOfSupply}</p>}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full text-sm border border-mitti/10 mb-4">
          <thead className="bg-beige/60 text-mitti text-xs label">
            <tr>
              <th className="text-left p-2">DESCRIPTION</th>
              <th className="text-left p-2">HSN</th>
              <th className="text-right p-2">QTY</th>
              <th className="text-right p-2">UNIT</th>
              <th className="text-right p-2">DISC.</th>
              <th className="text-right p-2">TAXABLE</th>
              <th className="text-right p-2">GST</th>
              <th className="text-right p-2">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l: any) => (
              <tr key={l.id} className="border-t border-mitti/10">
                <td className="p-2 text-kohl">{l.description}</td>
                <td className="p-2 text-mitti text-xs">{l.hsnSac || '—'}</td>
                <td className="p-2 text-right">{l.quantity}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(l.unitPricePaise)}</td>
                <td className="p-2 text-right tabular-nums text-mitti">{l.discountPaise ? formatINR(l.discountPaise) : '—'}</td>
                <td className="p-2 text-right tabular-nums">{formatINR(l.taxableValuePaise)}</td>
                <td className="p-2 text-right tabular-nums">{l.gstRatePercent}% ({formatINR(l.cgstPaise + l.sgstPaise + l.igstPaise)})</td>
                <td className="p-2 text-right tabular-nums font-medium">{formatINR(l.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <table className="text-sm">
            <tbody>
              <TotalRow label="Taxable value" amount={inv.taxableValuePaise} />
              {inv.discountPaise > 0 && <TotalRow label="Discount" amount={-inv.discountPaise} />}
              {inv.cgstPaise > 0 && <TotalRow label="CGST" amount={inv.cgstPaise} />}
              {inv.sgstPaise > 0 && <TotalRow label="SGST" amount={inv.sgstPaise} />}
              {inv.igstPaise > 0 && <TotalRow label="IGST" amount={inv.igstPaise} />}
              {inv.shippingPaise > 0 && <TotalRow label="Shipping" amount={inv.shippingPaise} />}
              {inv.shippingTaxPaise > 0 && <TotalRow label="Shipping GST" amount={inv.shippingTaxPaise} />}
              <tr className="border-t border-mitti/30 font-display text-lg">
                <td className="py-2 pr-8">TOTAL</td>
                <td className="text-right tabular-nums">{formatINR(inv.totalPaise)}</td>
              </tr>
              {inv.paidPaise > 0 && (
                <>
                  <TotalRow label="Paid" amount={inv.paidPaise} />
                  <TotalRow label="Outstanding" amount={inv.totalPaise - inv.paidPaise} />
                </>
              )}
            </tbody>
          </table>
        </div>

        {inv.notes && (
          <div className="mt-6 text-xs text-mitti">
            <p className="label text-mitti mb-1">Notes</p>
            <p className="whitespace-pre-wrap">{inv.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 bg-white border border-mitti/10 p-4 print:hidden flex flex-wrap gap-2">
        <a href={`/api/admin/finance/sales-invoices/${inv.id}/print`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 px-3 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder">
          <Printer className="w-3 h-3" /> PRINT INVOICE (BRANDED)
        </a>
        <a href={`/api/admin/finance/sales-invoices/${inv.id}/print`} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 px-3 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory"
          title="Use the browser print dialog → Save as PDF">
          <Download className="w-3 h-3" /> DOWNLOAD PDF
        </a>
        {!inv.posted && (
          <button onClick={() => patch({ action: 'repost' })} disabled={busy}
            className="px-3 py-2 bg-banarasi text-ivory text-xs tracking-widest hover:bg-banarasi/80 disabled:opacity-50">
            POST TO LEDGER
          </button>
        )}
        {inv.paymentStatus !== 'CANCELLED' && inv.paymentStatus !== 'PAID' && (
          <button onClick={() => { if (confirm('Cancel this invoice? Any posted entries will be reversed.')) patch({ action: 'cancel' }); }} disabled={busy}
            className="px-3 py-2 border border-madder text-madder text-xs tracking-widest hover:bg-madder hover:text-ivory disabled:opacity-50">
            CANCEL INVOICE
          </button>
        )}
        {msg && <span className="text-xs text-mitti ml-2">{msg}</span>}
      </div>

      {/* Payments */}
      {inv.payments?.length > 0 && (
        <div className="mt-4 bg-white border border-mitti/10 p-5 print:hidden">
          <h2 className="font-display text-xl text-kohl mb-3">Payments received</h2>
          <table className="w-full text-xs">
            <thead className="text-mitti label">
              <tr><th className="text-left p-2">DATE</th><th className="text-left p-2">METHOD</th><th className="text-left p-2">REFERENCE</th><th className="text-right p-2">AMOUNT</th></tr>
            </thead>
            <tbody>
              {inv.payments.map((p: any) => (
                <tr key={p.id} className="border-t border-mitti/10">
                  <td className="p-2 text-mitti">{new Date(p.paidOn).toLocaleDateString('en-IN')}</td>
                  <td className="p-2 text-mitti">{p.method || '—'}</td>
                  <td className="p-2 text-mitti">{p.reference || '—'}</td>
                  <td className="p-2 text-right tabular-nums text-emerald-700">{formatINR(p.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revenue ledger breakup */}
      {entries.length > 0 && (
        <div className="mt-4 bg-white border border-mitti/10 p-5 print:hidden">
          <h2 className="font-display text-xl text-kohl mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" /> Revenue ledger breakup
          </h2>
          <p className="text-xs text-mitti mb-3">Auto-posted entries from this invoice. Each row hits a different ledger.</p>
          <table className="w-full text-xs">
            <thead className="text-mitti label">
              <tr>
                <th className="text-left p-2">LEDGER</th>
                <th className="text-left p-2">STATUS</th>
                <th className="text-left p-2">DESCRIPTION</th>
                <th className="text-right p-2">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id} className="border-t border-mitti/10">
                  <td className="p-2 text-kohl">{TYPE_LABEL[e.type] || e.type}</td>
                  <td className="p-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] tracking-widest ${
                      e.status === 'REALIZED' ? 'bg-emerald-100 text-emerald-800' :
                      e.status === 'REVERSED' ? 'bg-madder/10 text-madder'        :
                                                'bg-amber-100 text-amber-800'
                    }`}>{e.status}</span>
                  </td>
                  <td className="p-2 text-mitti">{e.notes || '—'}</td>
                  <td className={`p-2 text-right tabular-nums ${e.amountPaise > 0 ? 'text-emerald-700' : 'text-madder'}`}>
                    {formatINR(e.amountPaise)}
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

function TotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <tr>
      <td className="py-1 pr-8 text-mitti">{label}</td>
      <td className="text-right tabular-nums">{formatINR(amount)}</td>
    </tr>
  );
}
