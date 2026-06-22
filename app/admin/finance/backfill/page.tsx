'use client';
// v23.40.7 — Admin: backfill orphan Expenses + Bills to vendor ledgers.
import { useState } from 'react';
import Link from 'next/link';
import { Eye, Play, Loader2, CheckCircle2, AlertTriangle, ArrowRight, ShoppingBag, Users, Link2, UserCheck, Undo2 } from 'lucide-react';
import { formatINR } from '@/lib/money';

type Tab = 'vendor' | 'order' | 'bill-expense' | 'customer' | 'refund';

export default function BackfillPage() {
  const [tab, setTab] = useState<Tab>('vendor');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState('');

  async function trigger(dryRun: boolean) {
    setErr(''); setResult(null); setBusy(true);
    try {
      const endpoint =
        tab === 'vendor'       ? '/api/admin/finance/backfill/vendor-links' :
        tab === 'order'        ? '/api/admin/finance/backfill/order-invoices' :
        tab === 'customer'     ? '/api/admin/finance/backfill/customer-links' :
        tab === 'refund'       ? '/api/admin/finance/backfill/refund-reversals' :
                                 '/api/admin/finance/backfill/bill-from-expense';
      const r = await fetch(`${endpoint}${dryRun ? '?dryRun=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setResult({ kind: tab, data: d });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="font-display text-3xl text-kohl">Backfill tools</h1>
      <p className="text-mitti text-sm mt-1">
        One-off migrations that catch legacy data up with the current data model.
      </p>

      {/* Tab switcher */}
      <div className="flex gap-1 mt-6 border-b border-mitti/10">
        <button onClick={() => { setTab('vendor'); setResult(null); setErr(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-widest ${tab === 'vendor' ? 'border-b-2 border-madder text-kohl' : 'text-mitti hover:text-kohl'}`}>
          <Users className="w-3.5 h-3.5" /> Vendor links
        </button>
        <button onClick={() => { setTab('order'); setResult(null); setErr(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-widest ${tab === 'order' ? 'border-b-2 border-madder text-kohl' : 'text-mitti hover:text-kohl'}`}>
          <ShoppingBag className="w-3.5 h-3.5" /> Order → invoice
        </button>
        <button onClick={() => { setTab('bill-expense'); setResult(null); setErr(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-widest ${tab === 'bill-expense' ? 'border-b-2 border-madder text-kohl' : 'text-mitti hover:text-kohl'}`}>
          <Link2 className="w-3.5 h-3.5" /> Bill ↔ expense pair-up
        </button>
        <button onClick={() => { setTab('customer'); setResult(null); setErr(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-widest ${tab === 'customer' ? 'border-b-2 border-madder text-kohl' : 'text-mitti hover:text-kohl'}`}>
          <UserCheck className="w-3.5 h-3.5" /> Customer links
        </button>
        <button onClick={() => { setTab('refund'); setResult(null); setErr(''); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs uppercase tracking-widest ${tab === 'refund' ? 'border-b-2 border-madder text-kohl' : 'text-mitti hover:text-kohl'}`}>
          <Undo2 className="w-3.5 h-3.5" /> Refund reversals
        </button>
      </div>

      {tab === 'refund' && (
        <div className="bg-amber-50 border border-amber-200 p-4 mt-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Refund reversals — post negative revenue for already-refunded orders</p>
            <p className="text-xs mt-1">
              Before v23.40.12, orders marked REFUNDED or CANCELLED kept their revenue posted to the P&L. This tool walks every such order,
              posts negative mirror RevenueEntries (-PRODUCT_REVENUE, -GST, -SELLER_PAYABLE for marketplace lines), and writes a negative
              SalesInvoicePayment so the customer ledger reflects the refund. Idempotent on <code>SalesInvoice.paymentStatus</code>.
            </p>
          </div>
        </div>
      )}

      {tab === 'customer' && (
        <div className="bg-amber-50 border border-amber-200 p-4 mt-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Customer Links — link existing sales invoices to customer profiles</p>
            <p className="text-xs mt-1">
              Pre-v23.40.11 sales invoices stored customer name/email/phone as free text. This tool walks every such invoice,
              matches it to an existing Customer (by phone → email → name), creates a new Customer profile if no match, and links the invoice.
              After running this, every customer shows up in <Link href="/admin/finance/customer-ledger" className="underline">Customer Ledgers</Link>
              with billed/received/outstanding/AR aging.
            </p>
          </div>
        </div>
      )}

      {tab === 'bill-expense' && (
        <div className="bg-amber-50 border border-amber-200 p-4 mt-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Bill ↔ Expense pair-up — retro-link legacy standalone expenses</p>
            <p className="text-xs mt-1">
              From v23.40.10 every Bill auto-creates a mirror Expense (and vice-versa). Pre-v23.40.10 the team often booked a vendor
              invoice as a standalone <b>Expense</b> with an invoice number, with no matching Bill. This tool walks every such
              expense and creates the missing Bill, then marks the expense <code>source=BILL</code> so the vendor ledger stops
              double-counting it.
            </p>
            <p className="text-xs mt-1">
              Criteria: expense has a vendor, has an invoice number, has <code>source=MANUAL</code>, and isn’t already linked from a Bill.
            </p>
          </div>
        </div>
      )}

      {tab === 'vendor' && (
        <div className="bg-amber-50 border border-amber-200 p-4 mt-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Vendor Links — link orphan expenses & bills to vendors</p>
            <ol className="list-decimal list-inside mt-1 text-xs space-y-0.5">
              <li>Click <b>PREVIEW</b> first — see how many records would be touched and which vendors would be created.</li>
              <li>Click <b>RUN BACKFILL</b> to actually link them.</li>
              <li>Open <Link href="/admin/finance/vendor-ledger" className="underline">Vendor Ledgers</Link> to see the result.</li>
            </ol>
          </div>
        </div>
      )}

      {tab === 'order' && (
        <div className="bg-amber-50 border border-amber-200 p-4 mt-4 text-sm text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Order → Invoice — post past PAID website orders to the revenue ledger</p>
            <p className="text-xs mt-1">
              Before v23.40.9, website orders did not auto-create SalesInvoices. This tool walks every PAID order without an invoice,
              creates one, and posts the full breakup (PRODUCT_REVENUE, GST output, COGS, SELLER_PAYABLE for marketplace items) to the revenue ledger.
            </p>
            <p className="text-xs mt-1">
              <b>For marketplace orders</b>: a ₹100 sale @ 20% commission books as ₹100 PRODUCT_REVENUE + ₹80 SELLER_PAYABLE (debit) = ₹20 net commission income to Neejee.
              For Neejee-owned items, COGS uses the most recent <code>PurchaseCost</code> row for the product.
            </p>
          </div>
        </div>
      )}

      <div className="bg-ivory border border-mitti/20 p-6 mt-4 flex gap-2">
        <button onClick={() => trigger(true)} disabled={busy}
          className="flex items-center gap-1 px-4 py-2 border border-kohl text-kohl text-xs tracking-widest hover:bg-kohl hover:text-ivory disabled:opacity-50">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
          PREVIEW (DRY RUN)
        </button>
        <button onClick={() => { if (confirm('Backfill all orphan expenses and bills? This writes to the DB but is non-destructive (only fills missing vendorId values).')) trigger(false); }}
          disabled={busy}
          className="flex items-center gap-1 px-4 py-2 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder disabled:opacity-50">
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          RUN BACKFILL
        </button>
      </div>

      {err && <p className="mt-4 text-madder text-xs bg-madder/10 border border-madder/30 p-3">{err}</p>}

      {result && result.kind === 'vendor' && (
        <div className="bg-ivory border border-mitti/20 p-6 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <h3 className="font-display text-xl text-kohl">
              {result.data.dryRun ? 'Preview (no changes made)' : 'Backfill complete'}
            </h3>
          </div>
          <ResultBlock title="Expenses" data={result.data.expenses} />
          <ResultBlock title="Bills"    data={result.data.bills} />
          {!result.data.dryRun && (
            <Link href="/admin/finance/vendor-ledger"
              className="mt-4 inline-flex items-center gap-1 text-sm text-madder hover:underline">
              Open Vendor Ledgers <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {result && result.kind === 'bill-expense' && (
        <div className="bg-ivory border border-mitti/20 p-6 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <h3 className="font-display text-xl text-kohl">
              {result.data.dryRun ? 'Preview (no changes made)' : 'Pair-up complete'}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Tile label="Scanned" value={String(result.data.result.scanned)} />
            <Tile label="Already linked" value={String(result.data.result.alreadyLinked)} muted />
            <Tile label="To convert" value={String(result.data.result.toConvert)} />
            <Tile label={result.data.dryRun ? 'Would convert' : 'Converted'} value={String(result.data.result.converted ?? result.data.result.toConvert)} good />
          </div>
          {result.data.result.samples?.length > 0 && (
            <details className="text-xs" open>
              <summary className="cursor-pointer text-mitti">Sample records ({result.data.result.samples.length})</summary>
              <ul className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                {result.data.result.samples.map((s: any, i: number) => (
                  <li key={i} className="text-mitti">
                    {s.vendor} — #{s.invoiceNumber} — <b>{formatINR(s.totalPaise)}</b>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.data.result.errors?.length > 0 && (
            <details className="text-xs mt-2">
              <summary className="cursor-pointer text-madder">Errors ({result.data.result.errors.length})</summary>
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {result.data.result.errors.map((e: any, i: number) => (
                  <li key={i} className="text-madder">{e.expenseId} — {e.error}</li>
                ))}
              </ul>
            </details>
          )}
          {!result.data.dryRun && (
            <Link href="/admin/finance/bills" className="mt-4 inline-flex items-center gap-1 text-sm text-madder hover:underline">
              View Bills (AP) <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {result && result.kind === 'refund' && (
        <div className="bg-ivory border border-mitti/20 p-6 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <h3 className="font-display text-xl text-kohl">
              {result.data.dryRun ? 'Preview (no changes made)' : 'Refund reversal complete'}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Tile label="Orders scanned" value={String(result.data.result.scanned)} />
            <Tile label={result.data.dryRun ? 'Would reverse' : 'Reversed'} value={String(result.data.result.reversed)} good />
            <Tile label="Skipped" value={String(result.data.result.skipped)} muted />
            <Tile label="Failed" value={String(result.data.result.failed)} />
          </div>
          {result.data.result.samples?.length > 0 && (
            <details className="text-xs" open>
              <summary className="cursor-pointer text-mitti">Samples ({result.data.result.samples.length})</summary>
              <ul className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                {result.data.result.samples.map((s: any, i: number) => (
                  <li key={i} className="text-mitti">
                    {s.orderNumber} — <b>{s.status}</b> — {s.action}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {result.data.result.errors?.length > 0 && (
            <details className="text-xs mt-2">
              <summary className="cursor-pointer text-madder">Errors ({result.data.result.errors.length})</summary>
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {result.data.result.errors.map((e: any, i: number) => (
                  <li key={i} className="text-madder">{e.orderId} — {e.error}</li>
                ))}
              </ul>
            </details>
          )}
          {!result.data.dryRun && (
            <Link href="/admin/finance/revenue-ledger?type=REFUND_REVERSAL" className="mt-4 inline-flex items-center gap-1 text-sm text-madder hover:underline">
              View reversals in Revenue Ledger <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {result && result.kind === 'customer' && (
        <div className="bg-ivory border border-mitti/20 p-6 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <h3 className="font-display text-xl text-kohl">
              {result.data.dryRun ? 'Preview (no changes made)' : 'Customer link backfill complete'}
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <Tile label="Orphan invoices scanned" value={String(result.data.result.scanned)} />
            <Tile label="Linked to existing customer" value={String(result.data.result.linkedExisting)} good />
            <Tile label="New customer created" value={String(result.data.result.createdNew)} good />
            <Tile label="Failed" value={String(result.data.result.failed)} />
          </div>
          {result.data.result.samples?.length > 0 && (
            <details className="text-xs" open>
              <summary className="cursor-pointer text-mitti">Samples ({result.data.result.samples.length})</summary>
              <ul className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                {result.data.result.samples.map((s: any, i: number) => (
                  <li key={i} className="text-mitti">
                    {s.invoiceNumber} — <b>{s.customer}</b> — {formatINR(s.totalPaise)} <span className="text-[10px] uppercase tracking-widest text-banarasi">[{s.matchedBy}]</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {!result.data.dryRun && (
            <Link href="/admin/finance/customer-ledger" className="mt-4 inline-flex items-center gap-1 text-sm text-madder hover:underline">
              View Customer Ledgers <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {result && result.kind === 'order' && (
        <div className="bg-ivory border border-mitti/20 p-6 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            <h3 className="font-display text-xl text-kohl">Order backfill</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            <Tile label="Scanned" value={String(result.data.scanned)} />
            <Tile label="Invoices created" value={String(result.data.created)} good />
            <Tile label="Skipped (already invoiced)" value={String(result.data.skipped)} muted />
            <Tile label="Failed" value={String(result.data.failed)} />
            <Tile label="Total invoiced" value={formatINR(result.data.totalPaise)} good />
          </div>
          {result.data.details?.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-mitti">Details ({result.data.details.length})</summary>
              <ul className="mt-2 space-y-1 max-h-72 overflow-y-auto">
                {result.data.details.slice(0, 200).map((d: any, i: number) => (
                  <li key={i} className="text-mitti">
                    {d.orderNumber} — <b>{d.action}</b>{d.invoiceNumber && ` (${d.invoiceNumber})`}{d.error && <span className="text-madder"> — {d.error}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex gap-3">
            <Link href="/admin/finance/sales-invoices?invoiceType=B2C" className="text-sm text-madder hover:underline inline-flex items-center gap-1">
              View B2C invoices <ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/admin/finance/revenue-ledger" className="text-sm text-madder hover:underline inline-flex items-center gap-1">
              View Revenue Ledger <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultBlock({ title, data }: { title: string; data: any }) {
  return (
    <div className="mb-6">
      <h4 className="label text-banarasi mb-2">{title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Tile label="Scanned"             value={String(data.scanned)} />
        <Tile label="Linked to existing"  value={String(data.linkedToExisting)} good />
        <Tile label="Vendor auto-created" value={String(data.vendorCreated)} good />
        <Tile label="Skipped"             value={String(data.skipped)} muted />
      </div>
      {data.details?.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-mitti">Details ({data.details.length})</summary>
          <ul className="mt-2 space-y-1 max-h-72 overflow-y-auto">
            {data.details.slice(0, 200).map((d: any, i: number) => (
              <li key={i} className="text-mitti">
                <span className="font-mono text-[10px]">{d.id.slice(-8)}</span> · {d.name} → <b>{d.action}</b>
                {d.vendorName && ` (${d.vendorName})`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Tile({ label, value, good, muted }: { label: string; value: string; good?: boolean; muted?: boolean }) {
  return (
    <div className={`p-3 ${good ? 'bg-emerald-50 border border-emerald-200' : muted ? 'bg-mitti/5' : 'bg-beige/40'}`}>
      <p className="label text-mitti text-[10px]">{label}</p>
      <p className={`font-display text-lg mt-1 ${good ? 'text-emerald-800' : 'text-kohl'}`}>{value}</p>
    </div>
  );
}
