'use client';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/money';
import { Loader2, Download } from 'lucide-react';

type PnlReport = any;   // typed loosely client-side; server has full types

const PRESETS = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_week',  label: 'This week' },
  { value: 'last_week',  label: 'Last week' },
  { value: 'custom',     label: 'Custom range' },
];

export default function PnlReportPage() {
  const [basis, setBasis] = useState<'cash' | 'accrual'>('cash');
  const [preset, setPreset] = useState('this_month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [report, setReport] = useState<PnlReport | null>(null);
  const [attribution, setAttribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const fetchReport = async () => {
    setLoading(true); setErr('');
    try {
      const params = new URLSearchParams({ basis });
      if (preset === 'custom') {
        if (!fromDate || !toDate) {
          setErr('Pick both dates'); setLoading(false); return;
        }
        params.set('from', fromDate); params.set('to', toDate);
      } else {
        params.set('preset', preset);
      }
      const r = await fetch(`/api/admin/finance/pnl?${params}`);
      const t = await r.text();
      let j: any = {}; try { j = JSON.parse(t); } catch { /* */ }
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setReport(j.pnl);
      setAttribution(j.attribution || []);
    } catch (e: any) {
      setErr(e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); /* eslint-disable-next-line */ }, [basis, preset]);

  const exportCsv = () => {
    if (!report) return;
    const rows: string[][] = [
      ['NEEJEE Profit & Loss'],
      ['Period', report.period.label],
      ['Basis', report.basis.toUpperCase()],
      ['Generated', new Date(report.generatedAt).toLocaleString('en-IN')],
      [],
      ['Section', 'Line', 'Amount (₹)'],
      ['REVENUE', 'Product sales',     (report.revenue.productSales / 100).toFixed(2)],
      ['REVENUE', 'Shipping charged',  (report.revenue.shippingCharged / 100).toFixed(2)],
      ['REVENUE', 'TOTAL',             (report.revenue.total / 100).toFixed(2)],
      ['DEDUCTIONS', 'Coupon discounts', (report.deductions.couponDiscounts / 100).toFixed(2)],
      ['DEDUCTIONS', 'Refunds',          (report.deductions.refunds / 100).toFixed(2)],
      ['DEDUCTIONS', 'TOTAL',            (report.deductions.total / 100).toFixed(2)],
      ['NET REVENUE', '', (report.netRevenue / 100).toFixed(2)],
      ['COGS', 'Product cost',         (report.cogs.productCost / 100).toFixed(2)],
      ['COGS', 'Inbound shipping',     (report.cogs.inboundShipping / 100).toFixed(2)],
      ['COGS', 'Packaging',            (report.cogs.packaging / 100).toFixed(2)],
      ['COGS', 'QC',                   (report.cogs.qc / 100).toFixed(2)],
      ['COGS', 'Returns write-back',   (report.cogs.writeBackFromReturns / 100).toFixed(2)],
      ['COGS', 'TOTAL',                (report.cogs.total / 100).toFixed(2)],
      ['GROSS PROFIT', '', (report.grossProfit / 100).toFixed(2)],
    ];

    for (const [group, lines] of Object.entries(report.opex)) {
      if (group === 'totalsByGroup' || group === 'grandTotal') continue;
      const lineArr = lines as any[];
      for (const ln of lineArr) {
        rows.push([`OPEX:${group.toUpperCase()}`, ln.label, (ln.amountPaise / 100).toFixed(2)]);
      }
    }
    rows.push(['OPEX', 'GRAND TOTAL', (report.opex.grandTotal / 100).toFixed(2)]);
    rows.push(['EBITDA', '', (report.ebitda / 100).toFixed(2)]);
    rows.push(['TAX', 'GST net payable', (report.tax.gstNetPayable / 100).toFixed(2)]);
    rows.push(['TAX', 'Income tax provision', (report.tax.incomeTaxProvision / 100).toFixed(2)]);
    rows.push(['NET PROFIT', '', (report.netProfit / 100).toFixed(2)]);

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neejee-pnl-${report.period.label.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-ivory border border-mitti/20 p-5 rounded">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="label text-banarasi mb-2">BASIS</p>
            <div className="inline-flex border border-mitti/30 rounded overflow-hidden">
              {(['cash', 'accrual'] as const).map(b => (
                <button key={b} onClick={() => setBasis(b)}
                  className={`px-4 py-2 font-ui text-xs tracking-widest uppercase ${basis === b ? 'bg-kohl text-ivory' : 'bg-ivory text-mitti hover:bg-beige'}`}>
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label text-banarasi mb-2">PERIOD</p>
            <select value={preset} onChange={e => setPreset(e.target.value)}
              className="border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory">
              {PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {preset === 'custom' && (
            <>
              <div>
                <p className="label text-banarasi mb-2">FROM</p>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
              </div>
              <div>
                <p className="label text-banarasi mb-2">TO</p>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
              </div>
              <button onClick={fetchReport} className="bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest">
                APPLY
              </button>
            </>
          )}
          {report && (
            <button onClick={exportCsv} className="ml-auto flex items-center gap-2 border border-kohl text-kohl px-4 py-2 font-ui text-xs tracking-widest">
              <Download className="w-3 h-3" /> EXPORT CSV
            </button>
          )}
        </div>
      </div>

      {err && <div className="bg-madder/10 border border-madder p-4 text-madder text-sm">{err}</div>}
      {loading && (
        <div className="bg-ivory border border-mitti/20 p-12 flex items-center justify-center text-mitti">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Computing P&L…
        </div>
      )}

      {report && !loading && (
        <>
          <div className="bg-ivory border border-mitti/20 p-6 rounded">
            <p className="font-italic italic text-mitti text-sm">
              {report.period.label} · {report.basis.toUpperCase()} basis
            </p>
            {report.diagnostics.notes.length > 0 && (
              <div className="bg-banarasi/10 p-3 mt-3 text-xs text-banarasi">
                {report.diagnostics.notes.map((n: string, i: number) => <div key={i}>⚠ {n}</div>)}
              </div>
            )}

            <table className="w-full mt-6 font-ui text-sm">
              <Section label="REVENUE">
                <Row label="Product sales"     val={report.revenue.productSales} />
                <Row label="Shipping charged"  val={report.revenue.shippingCharged} />
                <Row label="Total revenue"     val={report.revenue.total} bold />
              </Section>
              <Section label="DEDUCTIONS">
                <Row label="Coupon discounts" val={-report.deductions.couponDiscounts} />
                <Row label="Refunds"          val={-report.deductions.refunds} />
                <Row label="Total deductions" val={-report.deductions.total} bold />
              </Section>
              <Section label="" highlight>
                <Row label="NET REVENUE" val={report.netRevenue} bold large />
              </Section>
              <Section label="COGS">
                <Row label="Product cost"        val={-report.cogs.productCost} />
                <Row label="Inbound shipping"    val={-report.cogs.inboundShipping} />
                <Row label="Packaging"           val={-report.cogs.packaging} />
                <Row label="QC"                  val={-report.cogs.qc} />
                <Row label="Returns write-back"  val={-report.cogs.writeBackFromReturns} />
                <Row label="Total COGS"          val={-report.cogs.total} bold />
              </Section>
              <Section label="" highlight>
                <Row label="GROSS PROFIT" val={report.grossProfit} bold large />
              </Section>
              <Section label="OPERATING EXPENSES">
                {Object.entries(report.opex.totalsByGroup)
                  .filter(([_, v]) => (v as number) > 0)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .map(([grp, val]) => (
                    <Row key={grp} label={grp.charAt(0).toUpperCase() + grp.slice(1)} val={-(val as number)} />
                  ))}
                <Row label="Total OpEx" val={-report.opex.grandTotal} bold />
              </Section>
              <Section label="" highlight>
                <Row label="EBITDA" val={report.ebitda} bold large />
              </Section>
              <Section label="TAX">
                <Row label="GST output"          val={report.tax.gstOutput} muted />
                <Row label="GST input claimable" val={-report.tax.gstInputClaimable} muted />
                <Row label="GST net payable"     val={-report.tax.gstNetPayable} />
                <Row label="Income tax provision" val={-report.tax.incomeTaxProvision} />
                <Row label="Total tax"           val={-report.tax.total} bold />
              </Section>
              <Section label="" highlight strong>
                <Row label="NET PROFIT" val={report.netProfit} bold large />
              </Section>
            </table>

            <div className="mt-6 pt-6 border-t border-mitti/20 text-xs text-mitti">
              {report.diagnostics.orderCount} orders · {report.diagnostics.expenseCount} expense entries · {report.diagnostics.returnCount} returns · generated {new Date(report.generatedAt).toLocaleString('en-IN')}
            </div>
          </div>

          {/* Marketing attribution table */}
          {attribution.length > 0 && (
            <div className="bg-ivory border border-mitti/20 p-6 rounded">
              <h3 className="font-display text-xl text-kohl mb-1">Marketing attribution</h3>
              <p className="font-italic italic text-mitti text-sm mb-4">
                Revenue & spend per channel (via coupon → category map)
              </p>
              <table className="w-full font-ui text-sm">
                <thead className="text-mitti text-xs label">
                  <tr className="border-b border-mitti/20">
                    <th className="text-left py-2">CHANNEL</th>
                    <th className="text-right py-2">REVENUE</th>
                    <th className="text-right py-2">SPEND</th>
                    <th className="text-right py-2">BUDGET</th>
                    <th className="text-right py-2">ORDERS</th>
                    <th className="text-right py-2">CAC</th>
                    <th className="text-right py-2">ROMI</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.map((a: any) => (
                    <tr key={a.categoryId} className="border-b border-mitti/10">
                      <td className="py-2 text-kohl">{a.categoryLabel}</td>
                      <td className="py-2 text-right">{formatINR(a.revenuePaise)}</td>
                      <td className="py-2 text-right text-mitti">{formatINR(a.spendPaise)}</td>
                      <td className="py-2 text-right text-mitti">{formatINR(a.budgetPaise)}</td>
                      <td className="py-2 text-right">{a.orderCount}</td>
                      <td className="py-2 text-right">{a.cacPaise > 0 ? formatINR(a.cacPaise) : '—'}</td>
                      <td className={`py-2 text-right ${a.romiPct > 0 ? 'text-emerald-700' : 'text-madder'}`}>
                        {a.spendPaise > 0 ? `${a.romiPct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ label, highlight, strong, children }: { label?: string; highlight?: boolean; strong?: boolean; children: React.ReactNode }) {
  return (
    <>
      {label && (
        <tr><td colSpan={2} className="pt-5 pb-1 label text-banarasi text-[10px] tracking-widest">{label}</td></tr>
      )}
      <tbody className={highlight ? (strong ? 'bg-kohl/5' : 'bg-banarasi/5') : ''}>
        {children}
      </tbody>
    </>
  );
}

function Row({ label, val, bold, large, muted }: { label: string; val: number; bold?: boolean; large?: boolean; muted?: boolean }) {
  return (
    <tr>
      <td className={`py-1.5 ${bold ? 'font-display text-kohl' : 'text-mitti'} ${large ? 'text-base' : ''} ${muted ? 'text-mitti/60' : ''}`}>
        {label}
      </td>
      <td className={`py-1.5 text-right tabular-nums ${bold ? 'font-display text-kohl' : ''} ${large ? 'text-lg' : ''} ${muted ? 'text-mitti/60' : ''}`}>
        {formatINR(val)}
      </td>
    </tr>
  );
}
