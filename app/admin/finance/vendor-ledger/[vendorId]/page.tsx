'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Receipt, Download, ExternalLink } from 'lucide-react';
import { formatINR, paiseToRupees } from '@/lib/money';

interface LedgerEntry {
  // v23.40.2 — entries now include direct expenses + their payments
  date: string;
  type: 'BILL' | 'BILL_PAYMENT' | 'EXPENSE' | 'EXPENSE_PAYMENT' | 'PAYMENT'; // 'PAYMENT' kept for back-compat
  refId: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  receiptUrl?: string | null;
  method?: string | null;
  reference?: string | null;
  billNumber?: string | null;
  invoiceNumber?: string | null;
  category?: string | null;
}

interface Vendor {
  id: string;
  displayName?: string | null;
  legalName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  gstin?: string | null;
  status?: string;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  // v23.40.8
  serviceCategoryGroup?: string | null;
}

const GROUP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',                   label: 'Uncategorised' },
  { value: 'COGS_DIRECT',        label: 'Product Supplier (COGS)' },
  { value: 'OPEX_MARKETING',     label: 'Marketing' },
  { value: 'OPEX_COMMUNICATION', label: 'Communication (SMS/WA/Email)' },
  { value: 'OPEX_SHIPPING',      label: 'Logistics / Shipping' },
  { value: 'OPEX_PAYMENT',       label: 'Payment / Banking' },
  { value: 'OPEX_PLATFORM',      label: 'Platform / SaaS' },
  { value: 'OPEX_PEOPLE',        label: 'People / HR' },
  { value: 'OPEX_OFFICE',        label: 'Office / Facilities' },
  { value: 'OPEX_PROFESSIONAL',  label: 'Professional / Compliance' },
  { value: 'OPEX_TAX_OTHER',     label: 'Tax / Statutory' },
  { value: 'OPEX_OTHER',         label: 'Other' },
];

export default function VendorLedgerPage() {
  const params = useParams<{ vendorId: string }>();
  const vendorId = params.vendorId;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/finance/vendor-ledger/${vendorId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setVendor(d.vendor);
        setLedger(d.ledger || []);
        setSummary(d.summary);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [vendorId]);

  function downloadCsv() {
    const headers = ['Date', 'Type', 'Bill #', 'Description', 'Debit (Rs.)', 'Credit (Rs.)', 'Balance (Rs.)', 'Method', 'Reference'];
    const rows = ledger.map(e => [
      new Date(e.date).toLocaleDateString('en-IN'),
      e.type,
      e.billNumber || '',
      e.description.replace(/,/g, ';'),
      e.debitPaise ? paiseToRupees(e.debitPaise) : '',
      e.creditPaise ? paiseToRupees(e.creditPaise) : '',
      paiseToRupees(e.runningBalancePaise),
      e.method || '',
      e.reference || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vendor-ledger-${vendor?.displayName || vendor?.legalName || vendorId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-8">Loading vendor ledger…</div>;
  if (error) return <div className="p-8 text-madder">{error}</div>;
  if (!vendor) return <div className="p-8">Vendor not found</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/finance/bills" className="text-xs text-mitti hover:text-madder flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Back to Bills
      </Link>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="font-display text-3xl text-kohl">{vendor.displayName || vendor.legalName}</h1>
          <p className="text-xs text-mitti mt-1">
            {vendor.legalName !== (vendor.displayName || vendor.legalName) ? `${vendor.legalName} · ` : ''}
            {vendor.gstin && `GSTIN: ${vendor.gstin} · `}
            Status: {vendor.status}
          </p>
        </div>
        <button onClick={downloadCsv}
          className="text-xs flex items-center gap-1 px-3 py-2 bg-kohl text-ivory hover:bg-madder">
          <Download className="w-3 h-3" /> EXPORT CSV
        </button>
      </div>

      {/* v23.40.8 — inline category picker */}
      <div className="bg-ivory border border-mitti/20 p-3 mb-6 flex items-center gap-3 text-sm">
        <span className="label text-mitti text-[10px]">SERVICE CATEGORY</span>
        <select
          value={vendor.serviceCategoryGroup || ''}
          onChange={async (e) => {
            const next = e.target.value;
            setVendor({ ...vendor, serviceCategoryGroup: next || null });
            await fetch(`/api/admin/finance/vendor-ledger/${vendorId}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ serviceCategoryGroup: next || null }),
            });
          }}
          className="border border-mitti/30 px-3 py-1.5 bg-ivory text-sm">
          {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="text-[10px] text-mitti italic">
          Tag what this vendor supplies — e.g. “Product Supplier” for fabric / inventory vendors, “Communication” for Jio / Fast2SMS.
        </span>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card label="TOTAL BILLED" value={formatINR(summary.totalBilledPaise)} />
          <Card label="TOTAL PAID" value={formatINR(summary.totalPaidPaise)} />
          <Card label="OUTSTANDING" value={formatINR(summary.outstandingPaise)}
            valueClass={summary.outstandingPaise > 0 ? 'text-madder' : 'text-kohl'} />
          <Card label="BILL COUNT" value={String(summary.billCount)} />
        </div>
      )}

      {/* Banking details */}
      {(vendor.bankAccountName || vendor.bankAccountNumber) && (
        <div className="bg-beige p-4 mb-6">
          <p className="label text-mitti mb-2">BANKING DETAILS</p>
          <div className="text-xs text-kohl space-y-1">
            <div>{vendor.bankAccountName}</div>
            <div className="font-mono">{vendor.bankAccountNumber} · IFSC: {vendor.bankIfsc}</div>
            {vendor.contactEmail && <div>{vendor.contactEmail}</div>}
            {vendor.contactPhone && <div>{vendor.contactPhone}</div>}
          </div>
        </div>
      )}

      {/* Ledger table */}
      <div className="bg-white border border-mitti/10">
        <div className="p-4 border-b border-mitti/10">
          <h2 className="font-display text-xl text-kohl">Ledger (chronological)</h2>
        </div>
        {ledger.length === 0 ? (
          <p className="p-8 text-center text-mitti italic">No bills or payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-beige text-mitti text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-right">Debit (₹)</th>
                <th className="p-3 text-right">Credit (₹)</th>
                <th className="p-3 text-right">Balance (₹)</th>
                <th className="p-3 text-left">Attachment</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map(e => (
                <tr key={e.refId} className="border-t border-mitti/10 hover:bg-beige/30">
                  <td className="p-3 text-mitti">{new Date(e.date).toLocaleDateString('en-IN')}</td>
                  <td className="p-3">
                    {e.type === 'BILL' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-madder">
                        <FileText className="w-3 h-3" /> BILL {e.billNumber && `#${e.billNumber}`}
                      </span>
                    ) : e.type === 'EXPENSE' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-madder">
                        <FileText className="w-3 h-3" /> EXPENSE {e.invoiceNumber && `#${e.invoiceNumber}`}
                      </span>
                    ) : e.type === 'EXPENSE_PAYMENT' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <Receipt className="w-3 h-3" /> EXPENSE PAYMENT {e.method && `(${e.method})`}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <Receipt className="w-3 h-3" /> PAYMENT {e.method && `(${e.method})`}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-kohl">
                    {e.description}
                    {e.reference && <span className="text-[10px] text-mitti block">Ref: {e.reference}</span>}
                  </td>
                  <td className="p-3 text-right font-mono">{e.debitPaise ? formatINR(e.debitPaise) : '—'}</td>
                  <td className="p-3 text-right font-mono text-green-700">{e.creditPaise ? formatINR(e.creditPaise) : '—'}</td>
                  <td className={`p-3 text-right font-mono ${e.runningBalancePaise > 0 ? 'text-madder' : 'text-kohl'}`}>
                    {formatINR(e.runningBalancePaise)}
                  </td>
                  <td className="p-3">
                    {e.receiptUrl && (
                      <a href={e.receiptUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-madder hover:underline">
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, valueClass = 'text-kohl' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-beige p-4">
      <p className="label text-mitti">{label}</p>
      <p className={`font-display text-2xl ${valueClass} mt-2`}>{value}</p>
    </div>
  );
}
