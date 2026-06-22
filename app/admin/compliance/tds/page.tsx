'use client';
// Admin: TDS Certificates (Form 16A)
// - Toolbar: pick FY + Quarter, GENERATE certificates for all vendors with paid payouts
// - Table: all certificates with status (DRAFT vs ISSUED), gross, TDS, count
// - Row actions: view printable HTML (opens new tab), mark ISSUED (assigns cert number),
//   record TRACES filing receipt, download PDF (via print-to-PDF in browser)

import { useEffect, useState } from 'react';

type Row = {
  id: string;
  vendorId: string;
  vendorNameSnapshot: string;
  financialYear: string;
  quarter: number;
  periodStart: string;
  periodEnd: string;
  grossPaymentsPaise: number;
  tdsDeductedPaise: number;
  tdsRate: number;
  section: string;
  certificateNumber: string | null;
  issuedAt: string | null;
  tracesReceiptNo: string | null;
  tracesFilingDate: string | null;
  coveredPayoutIds: string[];
  vendor: { id: string; legalName: string; pan: string | null; gstin: string | null };
};

function currentFY() {
  const now = new Date();
  const m = now.getMonth();
  const y = now.getFullYear();
  // FY 2025-26 means Apr 2025 – Mar 2026
  if (m >= 3) return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  return `${y - 1}-${String(y % 100).padStart(2, '0')}`;
}

function currentQuarter() {
  const m = new Date().getMonth(); // 0-indexed
  if (m >= 3 && m <= 5) return 1;
  if (m >= 6 && m <= 8) return 2;
  if (m >= 9 && m <= 11) return 3;
  return 4;
}

export default function TdsCertificatesPage() {
  const [fy, setFy] = useState(currentFY());
  const [quarter, setQuarter] = useState(currentQuarter());
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState({ tds: 0, gross: 0, count: 0 });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/compliance/tds?fy=${fy}&q=${quarter}`);
      const data = await res.json();
      setRows(data.rows || []);
      setTotals(data.totals || { tds: 0, gross: 0, count: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fy, quarter]);

  async function generate() {
    if (!confirm(`Generate Form 16A certificates for ${fy} Q${quarter}? Existing rows will be updated, not duplicated.`)) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/compliance/tds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financialYear: fy, quarter }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      alert(`Generated/updated ${data.created} draft and ${data.updated} existing certificates.`);
      load();
    } catch (e: any) {
      alert(e.message || 'Failed');
    } finally {
      setGenerating(false);
    }
  }

  async function markIssued(row: Row) {
    const certNo = prompt(
      'Certificate number (leave blank for auto-generated):',
      row.certificateNumber || `NJ-16A-${row.financialYear}-Q${row.quarter}-${row.vendorId.slice(-4).toUpperCase()}`
    );
    if (certNo === null) return;
    const res = await fetch(`/api/admin/compliance/tds/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ISSUE', certificateNumber: certNo || undefined }),
    });
    if (!res.ok) {
      alert('Failed to issue');
      return;
    }
    load();
  }

  async function recordTraces(row: Row) {
    const receiptNo = prompt('TRACES receipt number (15-digit token):');
    if (!receiptNo) return;
    const filingDate = prompt('TRACES filing date (YYYY-MM-DD):');
    if (!filingDate) return;
    const res = await fetch(`/api/admin/compliance/tds/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RECORD_TRACES', tracesReceiptNo: receiptNo, tracesFilingDate: filingDate }),
    });
    if (!res.ok) {
      alert('Failed');
      return;
    }
    load();
  }

  const inr = (paise: number) =>
    '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex justify-between items-end mb-6">
        <div>
          <h1 className="font-display text-3xl">TDS Certificates · Form 16A</h1>
          <p className="text-sm text-charcoal/60 mt-1">
            Quarterly vendor TDS statements (sections 194Q / 194C). Generate, issue and record TRACES filings.
          </p>
        </div>
      </header>

      <div className="bg-beige/40 p-4 rounded mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs uppercase">
          Financial Year
          <input
            value={fy}
            onChange={e => setFy(e.target.value)}
            placeholder="2025-26"
            className="border border-charcoal/20 p-2 mt-1 font-mono"
          />
        </label>
        <label className="flex flex-col text-xs uppercase">
          Quarter
          <select
            value={quarter}
            onChange={e => setQuarter(Number(e.target.value))}
            className="border border-charcoal/20 p-2 mt-1"
          >
            <option value={1}>Q1 · Apr–Jun</option>
            <option value={2}>Q2 · Jul–Sep</option>
            <option value={3}>Q3 · Oct–Dec</option>
            <option value={4}>Q4 · Jan–Mar</option>
          </select>
        </label>
        <button
          onClick={generate}
          disabled={generating}
          className="btn-primary"
        >
          {generating ? 'Generating…' : 'GENERATE CERTIFICATES'}
        </button>
        <div className="ml-auto text-sm">
          <div>
            <span className="text-charcoal/60">Certificates:</span>{' '}
            <strong>{totals.count}</strong>
          </div>
          <div>
            <span className="text-charcoal/60">Total TDS:</span>{' '}
            <strong className="text-mitti">{inr(totals.tds)}</strong>
          </div>
          <div>
            <span className="text-charcoal/60">Gross payments:</span>{' '}
            <strong>{inr(totals.gross)}</strong>
          </div>
        </div>
      </div>

      <div className="border border-charcoal/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-beige/40 text-xs uppercase">
            <tr>
              <th className="text-left p-2">Vendor</th>
              <th className="text-left p-2">PAN</th>
              <th className="text-left p-2">Period</th>
              <th className="text-right p-2">Gross paid</th>
              <th className="text-right p-2">TDS @</th>
              <th className="text-right p-2">TDS</th>
              <th className="text-left p-2">Cert #</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-charcoal/50">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-charcoal/50">
                  No certificates yet. Click GENERATE to create them from paid vendor payouts.
                </td>
              </tr>
            )}
            {rows.map(r => (
              <tr key={r.id} className="border-t border-charcoal/5 hover:bg-beige/20">
                <td className="p-2">
                  <div className="font-medium">{r.vendor.legalName || r.vendorNameSnapshot}</div>
                  <div className="text-xs text-charcoal/50">{r.coveredPayoutIds.length} payouts</div>
                </td>
                <td className="p-2 font-mono text-xs">{r.vendor.pan || '—'}</td>
                <td className="p-2">
                  {r.financialYear} Q{r.quarter}
                </td>
                <td className="p-2 text-right">{inr(r.grossPaymentsPaise)}</td>
                <td className="p-2 text-right">{r.tdsRate}%</td>
                <td className="p-2 text-right font-medium text-mitti">{inr(r.tdsDeductedPaise)}</td>
                <td className="p-2 font-mono text-xs">{r.certificateNumber || '—'}</td>
                <td className="p-2">
                  {r.issuedAt ? (
                    <span className="text-xs bg-mitti/10 text-mitti px-2 py-1">ISSUED</span>
                  ) : (
                    <span className="text-xs bg-charcoal/10 px-2 py-1">DRAFT</span>
                  )}
                  {r.tracesReceiptNo && (
                    <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1">TRACES</span>
                  )}
                </td>
                <td className="p-2 space-x-2 whitespace-nowrap">
                  <a
                    href={`/api/admin/compliance/tds/${r.id}?html=1`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                  >
                    VIEW / PRINT
                  </a>
                  {!r.issuedAt && (
                    <button onClick={() => markIssued(r)} className="text-xs underline">
                      ISSUE
                    </button>
                  )}
                  {r.issuedAt && !r.tracesReceiptNo && (
                    <button onClick={() => recordTraces(r)} className="text-xs underline">
                      RECORD TRACES
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-charcoal/50">
        Open VIEW / PRINT, then use the browser&apos;s <strong>Print → Save as PDF</strong> to issue the statement to the vendor.
      </p>
    </div>
  );
}
