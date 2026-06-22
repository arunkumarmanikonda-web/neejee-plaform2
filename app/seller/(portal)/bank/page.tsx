'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, AlertCircle } from 'lucide-react';

export default function BankPage() {
  const [seller, setSeller] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [original, setOriginal] = useState<any>({});
  const [docs, setDocs] = useState<any[]>([]);
  const [pickedDocs, setPickedDocs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    const [pR, dR] = await Promise.all([
      fetch('/api/seller/profile'),
      fetch('/api/seller/documents'),
    ]);
    const pJ = await pR.json();
    const dJ = await dR.json();
    setSeller(pJ.seller); setForm(pJ.seller || {}); setOriginal(pJ.seller || {});
    setDocs((dJ.documents || []).filter((d: any) =>
      ['CANCELLED_CHEQUE', 'BANK_STATEMENT'].includes(d.docType)
    ));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const isFirstTime = !original.bankAccount;
  const changed = ['bankAccount', 'ifsc', 'bankName'].some(k => form[k] !== original[k]);
  const needsApproval = !isFirstTime && changed;

  const submit = async () => {
    setErr(''); setMsg(''); setSaving(true);
    try {
      const changes: any = {};
      for (const k of ['bankAccount', 'ifsc', 'bankName']) {
        if (form[k] !== original[k]) changes[k] = form[k];
      }
      if (Object.keys(changes).length === 0) {
        setMsg('No changes'); setSaving(false); return;
      }
      const r = await fetch('/api/seller/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes, supportingDocIds: pickedDocs }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(j.message);
      setPickedDocs([]);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl text-kohl">Bank Account</h1>
        <p className="text-mitti text-sm">Where we send your payouts.</p>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}
      {err && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

      <div className="bg-ivory border border-mitti/20 p-6 rounded space-y-4">
        <Field label="Account holder name" value={form.businessName || ''} disabled />
        <Field label="Account number" value={form.bankAccount || ''} onChange={v => setForm({ ...form, bankAccount: v })} />
        <Field label="IFSC code" value={form.ifsc || ''} onChange={v => setForm({ ...form, ifsc: v?.toUpperCase() })} placeholder="HDFC0001234" />
        <Field label="Bank name" value={form.bankName || ''} onChange={v => setForm({ ...form, bankName: v })} />
      </div>

      {needsApproval && (
        <div className="bg-banarasi/10 border border-banarasi/40 p-5 rounded">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-banarasi mt-0.5" />
            <div>
              <h4 className="font-display text-kohl">Bank changes need admin approval</h4>
              <p className="text-mitti text-sm">Attach a cancelled cheque or recent bank statement.</p>
            </div>
          </div>
          {docs.length === 0 ? (
            <p className="text-mitti text-sm italic">Upload a cancelled cheque from the Documents page first.</p>
          ) : (
            <div className="space-y-1">
              {docs.map(d => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={pickedDocs.includes(d.id)}
                    onChange={e => setPickedDocs(e.target.checked ? [...pickedDocs, d.id] : pickedDocs.filter(x => x !== d.id))} />
                  <span className="text-kohl">{d.docType.replace(/_/g, ' ')}</span>
                  <span className="text-mitti text-xs">{d.fileName}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={submit} disabled={saving}
        className="bg-kohl text-ivory px-6 py-2.5 font-ui text-xs tracking-widest flex items-center gap-2 disabled:opacity-50">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        {needsApproval ? 'SUBMIT FOR APPROVAL' : isFirstTime ? 'SAVE BANK DETAILS' : 'SAVE'}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange?: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input value={value} onChange={e => onChange?.(e.target.value)} disabled={disabled}
        placeholder={placeholder}
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory disabled:opacity-60" />
    </div>
  );
}
