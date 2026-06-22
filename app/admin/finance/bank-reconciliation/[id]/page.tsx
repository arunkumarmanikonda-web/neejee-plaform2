'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, RefreshCw, CheckCircle, XCircle, AlertTriangle, Search, FileText, FileSpreadsheet, FileType, X } from 'lucide-react';
import { formatINR } from '@/lib/money';

interface Txn {
  id: string;
  txnDate: string;
  description: string;
  reference?: string | null;
  debitPaise: number;
  creditPaise: number;
  balancePaise?: number | null;
  status: string;
  matchedBillPaymentId?: string | null;
  matchedExpenseId?: string | null;
  matchedRefundId?: string | null;
  matchNotes?: string | null;
}

const STATUS_TABS = ['UNMATCHED', 'AUTO_MATCHED', 'MANUAL_MATCHED', 'IGNORED', 'DRAFT', 'ALL'] as const;

export default function BankAccountReconPage() {
  const params = useParams<{ id: string }>();
  const accountId = params.id;
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<typeof STATUS_TABS[number]>('UNMATCHED');
  const [csvText, setCsvText] = useState('');
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [accountName, setAccountName] = useState('');

  async function loadAccount() {
    const r = await fetch('/api/admin/finance/bank-accounts');
    const d = await r.json();
    const a = (d.accounts || []).find((x: any) => x.id === accountId);
    if (a) setAccountName(a.nickname);
  }

  async function loadTxns() {
    setLoading(true);
    const status = tab === 'ALL' ? '' : `?status=${tab}`;
    const r = await fetch(`/api/admin/finance/bank-accounts/${accountId}/transactions${status}`);
    const d = await r.json();
    setTxns(d.transactions || []);
    setLoading(false);
  }

  useEffect(() => { loadAccount(); }, [accountId]);
  useEffect(() => { loadTxns(); }, [accountId, tab]);

  async function importFile() {
    if (!pickedFile && !csvText.trim()) return;
    setImporting(true); setImportMsg('');
    try {
      let r: Response;
      if (pickedFile) {
        // Multi-format upload (CSV/TSV/PDF/Excel) via FormData
        const fd = new FormData();
        fd.append('file', pickedFile);
        r = await fetch(`/api/admin/finance/bank-accounts/${accountId}/import-file`, {
          method: 'POST', body: fd,
        });
      } else {
        // Paste-mode CSV via JSON
        r = await fetch(`/api/admin/finance/bank-accounts/${accountId}/import-csv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvText }),
        });
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Import failed');
      const src = d.sourceKind ? `${d.sourceKind} (${d.format})` : d.format;
      setImportMsg(`✓ ${src}: ${d.inserted} new, ${d.skipped} duplicates skipped · ${d.matched?.autoMatched || 0} auto-matched`);
      setCsvText('');
      setPickedFile(null);
      await loadTxns();
    } catch (e: any) {
      setImportMsg(`✗ ${e.message}`);
    } finally { setImporting(false); }
  }

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    setPickedFile(f);
    setCsvText(''); // file mode takes precedence
    setImportMsg('');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    pickFile(e.target.files?.[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  function fileIcon(name: string) {
    const ext = name.toLowerCase().split('.').pop() || '';
    if (['xlsx', 'xls', 'xlsm', 'csv', 'tsv'].includes(ext)) return <FileSpreadsheet className="w-6 h-6 text-green-700" />;
    if (ext === 'pdf') return <FileText className="w-6 h-6 text-madder" />;
    return <FileType className="w-6 h-6 text-mitti" />;
  }

  async function doAction(txnId: string, action: string, extra?: any) {
    const r = await fetch(`/api/admin/finance/bank-transactions/${txnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    });
    if (r.ok) await loadTxns();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/admin/finance/bank-reconciliation" className="text-xs text-mitti hover:text-madder flex items-center gap-1 mb-4">
        <ArrowLeft className="w-3 h-3" /> Back to accounts
      </Link>

      <h1 className="font-display text-3xl text-kohl mb-6">{accountName || 'Bank account'}</h1>

      {/* Statement upload */}
      <div className="bg-beige p-5 mb-6">
        <h2 className="font-display text-lg text-kohl mb-2 flex items-center gap-2">
          <Upload className="w-4 h-4" /> Import bank statement
        </h2>
        <p className="text-xs text-mitti mb-3">
          Drag &amp; drop or click below. Accepts <strong>CSV</strong>, <strong>TSV</strong>, <strong>Excel (.xlsx, .xls)</strong>,
          <strong> pipe-delimited TXT</strong>, and text-layer <strong>PDFs</strong>. Duplicates are auto-detected by content hash.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
            dragging ? 'border-madder bg-madder/5' : 'border-mitti/30 hover:border-kohl bg-ivory'
          }`}
          onClick={() => document.getElementById('bank-file-input')?.click()}
        >
          {pickedFile ? (
            <div className="flex items-center justify-center gap-3">
              {fileIcon(pickedFile.name)}
              <div className="text-left">
                <p className="text-sm text-kohl font-medium">{pickedFile.name}</p>
                <p className="text-[10px] text-mitti">{(pickedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setPickedFile(null); }}
                className="ml-3 p-1 hover:bg-madder hover:text-ivory"
              ><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-mitti/60 mx-auto mb-2" />
              <p className="text-xs uppercase tracking-widest text-kohl">DROP FILE OR CLICK TO BROWSE</p>
              <p className="text-[10px] text-mitti mt-1">CSV · TSV · Excel · PDF · max 20 MB</p>
            </>
          )}
          <input
            id="bank-file-input"
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.pdf"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={importFile}
            disabled={(!pickedFile && !csvText.trim()) || importing}
            className="flex-1 bg-kohl text-ivory px-4 py-3 text-xs tracking-widest disabled:opacity-50"
          >
            {importing ? 'IMPORTING…' : `IMPORT${pickedFile ? ` ${pickedFile.name.split('.').pop()?.toUpperCase()}` : ''}`}
          </button>
          <details className="flex-1">
            <summary className="cursor-pointer px-4 py-3 bg-ivory border border-mitti/30 text-xs tracking-widest text-center hover:bg-beige">
              OR PASTE CSV TEXT
            </summary>
            <textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); setPickedFile(null); }}
              placeholder="Date,Description,Debit,Credit,Balance\n15/06/2026,NEFT-ABC,5000.00,,123456.00"
              rows={6}
              className="w-full mt-2 p-2 border border-mitti/30 font-mono text-xs bg-ivory"
            />
          </details>
        </div>

        {csvText && !pickedFile && (
          <p className="text-[10px] text-mitti mt-2">Paste: {csvText.length.toLocaleString()} chars · {csvText.split('\n').length} lines</p>
        )}
        {importMsg && (
          <p className={`mt-3 p-3 text-sm ${importMsg.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {importMsg}
          </p>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-mitti/10 overflow-x-auto">
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => setTab(s)}
            className={`px-4 py-2 text-xs uppercase tracking-widest ${tab === s ? 'border-b-2 border-madder text-kohl' : 'text-mitti hover:text-kohl'}`}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Transactions */}
      {loading ? <p className="text-mitti">Loading…</p> : txns.length === 0 ? (
        <p className="text-mitti italic">No transactions in this status.</p>
      ) : (
        <table className="w-full text-sm bg-white border border-mitti/10">
          <thead className="bg-beige text-mitti text-xs uppercase tracking-wider">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Reference</th>
              <th className="p-3 text-right">Debit</th>
              <th className="p-3 text-right">Credit</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {txns.map(t => (
              <tr key={t.id} className="border-t border-mitti/10 hover:bg-beige/30">
                <td className="p-3 text-mitti whitespace-nowrap">{new Date(t.txnDate).toLocaleDateString('en-IN')}</td>
                <td className="p-3 text-kohl text-xs">
                  {t.description}
                  {t.matchNotes && <span className="block text-[10px] text-mitti italic mt-1">{t.matchNotes}</span>}
                </td>
                <td className="p-3 text-mitti text-xs font-mono">{t.reference || '—'}</td>
                <td className="p-3 text-right tabular-nums text-madder">{t.debitPaise ? formatINR(t.debitPaise) : '—'}</td>
                <td className="p-3 text-right tabular-nums text-green-700">{t.creditPaise ? formatINR(t.creditPaise) : '—'}</td>
                <td className="p-3 text-center">
                  <StatusBadge status={t.status} />
                </td>
                <td className="p-3 text-right text-xs whitespace-nowrap">
                  {t.status === 'UNMATCHED' && (
                    <>
                      <button onClick={() => doAction(t.id, 'SUGGEST').then(() => loadTxns())}
                        className="text-banarasi hover:underline mr-2" title="Re-run matcher on this row">
                        <Search className="w-3 h-3 inline" />
                      </button>
                      <button onClick={() => doAction(t.id, 'IGNORE')}
                        className="text-mitti hover:text-madder">IGNORE</button>
                    </>
                  )}
                  {(t.status === 'AUTO_MATCHED' || t.status === 'MANUAL_MATCHED' || t.status === 'IGNORED') && (
                    <button onClick={() => doAction(t.id, 'UNMATCH')}
                      className="text-mitti hover:text-madder">UNMATCH</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    UNMATCHED:       { cls: 'bg-amber-100 text-amber-800',   icon: AlertTriangle, label: 'UNMATCHED' },
    AUTO_MATCHED:    { cls: 'bg-green-100 text-green-800',   icon: CheckCircle, label: 'AUTO MATCHED' },
    MANUAL_MATCHED:  { cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle, label: 'MANUAL' },
    IGNORED:         { cls: 'bg-mitti/20 text-kohl',           icon: XCircle, label: 'IGNORED' },
    DRAFT:           { cls: 'bg-banarasi/20 text-banarasi',    icon: AlertTriangle, label: 'DRAFT' },
  };
  const s = map[status] || { cls: '', icon: AlertTriangle, label: status };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider ${s.cls}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}
