'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Landmark, Clock, AlertTriangle, FileWarning } from 'lucide-react';

const BANK_FIELDS = ['bankAccountName','bankAccountNumber','bankIfsc','bankName'] as const;

export default function VendorBankPage() {
  const [vendor, setVendor] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [requireDocs, setRequireDocs] = useState(false);

  const load = async () => {
    const [pRes, dRes] = await Promise.all([
      fetch('/api/vendor/profile', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/vendor/documents', { cache: 'no-store' }).then(r => r.json()),
    ]);
    if (pRes.vendor) { setVendor(pRes.vendor); setForm(pRes.vendor); setPending(pRes.pendingRequests || []); }
    setDocs((dRes.documents || []).filter((d: any) => ['CANCELLED_CHEQUE','BANK_STATEMENT'].includes(d.docType) && d.status !== 'REJECTED'));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const fieldHasPending = (field: string) => pending.some(req =>
    Array.isArray(req.fieldChanges) && req.fieldChanges.some((c: any) => c.field === field)
  );
  const isFirstTime = vendor && BANK_FIELDS.every(f => !vendor[f]);

  const save = async (supportingDocIds: string[] = []) => {
    setSaving(true); setMsg(null);
    try {
      const changed: Record<string, any> = {};
      for (const k of BANK_FIELDS) {
        if (vendor[k] !== form[k] && !fieldHasPending(k)) changed[k] = form[k];
      }
      if (Object.keys(changed).length === 0) { setMsg({ kind: 'info', text: 'No changes to save.' }); return; }
      const r = await fetch('/api/vendor/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: changed, supportingDocIds }),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d?.requiredDocsForFields) {
          setRequireDocs(true); setShowDocPicker(true);
          setMsg({ kind: 'err', text: 'Please attach a cancelled cheque or bank statement.' });
        } else {
          throw new Error(d?.error || 'Save failed');
        }
        return;
      }
      const parts: string[] = [];
      if (d.directApplied?.length) parts.push(`${d.directApplied.length} field${d.directApplied.length > 1 ? 's' : ''} saved`);
      if (d.pendingFields?.length) parts.push(`${d.pendingFields.length} change${d.pendingFields.length > 1 ? 's' : ''} submitted for approval`);
      setMsg({ kind: 'ok', text: parts.join(' · ') || 'Saved' });
      setShowDocPicker(false);
      setSelected([]);
      await load();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;
  if (!vendor) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8 space-y-5">
      <header>
        <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
          <Landmark className="w-6 h-6 text-madder" /> Bank Account
        </h1>
        <p className="text-sm text-mitti mt-1">
          {isFirstTime
            ? 'First-time setup. Once saved, future changes require admin verification with a cancelled cheque.'
            : 'Changing bank details requires NEEJEE finance team verification. Upload a fresh cancelled cheque or bank statement, then submit.'}
        </p>
      </header>

      <section className="bg-ivory border border-mitti/15 p-5 space-y-3">
        {BANK_FIELDS.map(f => (
          <label key={f} className="block">
            <span className="text-[10px] uppercase tracking-widest text-mitti flex items-center gap-2">
              {labelFor(f)}
              {fieldHasPending(f) && (
                <span className="inline-flex items-center gap-1 bg-haldi/30 text-mitti px-2 py-0.5 normal-case tracking-normal">
                  <Clock className="w-3 h-3" /> Pending review
                </span>
              )}
            </span>
            <input
              value={form[f] || ''}
              disabled={fieldHasPending(f)}
              onChange={e => setForm({ ...form, [f]: e.target.value })}
              className={`mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm ${f === 'bankAccountNumber' || f === 'bankIfsc' ? 'font-mono' : 'font-ui'} ${fieldHasPending(f) ? 'opacity-60' : ''}`}
            />
          </label>
        ))}
      </section>

      {msg && (
        <div className={`p-3 text-sm border ${
          msg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800'
          : msg.kind === 'info' ? 'bg-beige border-mitti/20 text-mitti'
          : 'bg-madder/5 border-madder/30 text-madder'
        }`}>{msg.text}</div>
      )}

      <div className="flex gap-2">
        {isFirstTime ? (
          <button disabled={saving} onClick={() => save([])} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} SAVE BANK DETAILS
          </button>
        ) : (
          <button disabled={saving} onClick={() => setShowDocPicker(true)} className="btn-primary inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> SUBMIT FOR APPROVAL
          </button>
        )}
      </div>

      {showDocPicker && (
        <div className="fixed inset-0 bg-kohl/40 z-50 flex items-center justify-center p-4">
          <div className="bg-ivory max-w-md w-full p-6 space-y-3">
            <h2 className="font-display text-xl text-kohl flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-madder" /> Attach supporting document
            </h2>
            <p className="text-xs text-mitti">Choose a cancelled cheque or bank statement that matches the new bank details.</p>
            {docs.length === 0 ? (
              <p className="text-xs text-madder">No bank documents uploaded yet. <Link href="/vendor/documents" className="underline">Upload one now</Link>.</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto">
                {docs.map(d => (
                  <li key={d.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(d.id)}
                      onChange={e => setSelected(e.target.checked ? [...selected, d.id] : selected.filter(x => x !== d.id))}
                    />
                    <span className="flex-1">{d.fileName}</span>
                    <span className="text-[10px] uppercase tracking-widest text-mitti">{d.docType.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setShowDocPicker(false); setSelected([]); }} className="btn-ghost text-xs">Cancel</button>
              <button disabled={saving || selected.length === 0} onClick={() => save(selected)} className="btn-primary text-xs inline-flex items-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                SUBMIT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function labelFor(field: string) {
  switch (field) {
    case 'bankAccountName':   return 'Account holder name';
    case 'bankAccountNumber': return 'Account number';
    case 'bankIfsc':          return 'IFSC';
    case 'bankName':          return 'Bank name';
    default: return field;
  }
}
