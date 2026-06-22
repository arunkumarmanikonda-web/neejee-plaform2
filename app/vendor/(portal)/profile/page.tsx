'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Save, AlertTriangle, Clock, FileWarning } from 'lucide-react';

type Vendor = {
  legalName: string; displayName: string | null; contactPerson: string | null;
  contactEmail: string; contactPhone: string | null;
  gstin: string | null; pan: string | null; msmeNumber: string | null;
  addressLine1: string | null; addressLine2: string | null;
  city: string | null; state: string | null; pincode: string | null; country: string;
  status: string;
};

const APPROVAL_GATED = new Set([
  'legalName','gstin','pan','msmeNumber',
  'bankAccountName','bankAccountNumber','bankIfsc','bankName',
  'addressLine1','addressLine2','city','state','pincode','country',
]);

export default function VendorProfilePage() {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<any>({});
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [requiredDocs, setRequiredDocs] = useState<Record<string, string[]> | null>(null);

  const load = async () => {
    const r = await fetch('/api/vendor/profile', { cache: 'no-store' });
    const d = await r.json();
    if (d.vendor) { setVendor(d.vendor); setForm(d.vendor); setPending(d.pendingRequests || []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const fieldHasPending = (field: string) => pending.some(req =>
    Array.isArray(req.fieldChanges) && req.fieldChanges.some((c: any) => c.field === field)
  );
  const pendingValueFor = (field: string) => {
    for (const req of pending) {
      const found = (req.fieldChanges || []).find((c: any) => c.field === field);
      if (found) return found.newValue;
    }
    return null;
  };

  const save = async (supportingDocIds: string[] = [], reason?: string) => {
    setSaving(true); setMsg(null); setRequiredDocs(null);
    try {
      // Only send fields that actually changed
      const changed: Record<string, any> = {};
      for (const k of Object.keys(form)) {
        if (vendor && (vendor as any)[k] !== form[k] && !fieldHasPending(k)) {
          changed[k] = form[k];
        }
      }
      if (Object.keys(changed).length === 0) {
        setMsg({ kind: 'info', text: 'No changes to save.' });
        setSaving(false);
        return;
      }
      const r = await fetch('/api/vendor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: changed, supportingDocIds, reason }),
      });
      const text = await r.text();
      let d: any = null; try { d = text ? JSON.parse(text) : null; } catch {}
      if (!r.ok) {
        if (d?.requiredDocsForFields) {
          setRequiredDocs(d.requiredDocsForFields);
          setMsg({ kind: 'err', text: d.error });
        } else {
          throw new Error(d?.error || `Save failed (HTTP ${r.status})`);
        }
        return;
      }
      const parts: string[] = [];
      if (d.directApplied?.length) parts.push(`${d.directApplied.length} field${d.directApplied.length > 1 ? 's' : ''} updated`);
      if (d.pendingFields?.length) parts.push(`${d.pendingFields.length} change${d.pendingFields.length > 1 ? 's' : ''} submitted for admin review`);
      setMsg({ kind: 'ok', text: parts.join(' · ') || 'Saved' });
      await load();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;
  if (!vendor) return <div className="p-8 text-sm text-madder">No profile.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-5">
      <header className="mb-2">
        <h1 className="font-display text-3xl text-kohl">Profile</h1>
        <p className="text-sm text-mitti">
          Some fields are sensitive (bank, GST, address) and require admin verification on edit.
          Upload supporting documents from the <Link href="/vendor/documents" className="text-madder underline">Documents</Link> tab first.
        </p>
      </header>

      <Section title="Business">
        <Row label="Display name" hint="The name we'll show on POs and emails">
          <input value={form.displayName || ''} onChange={e => setForm({ ...form, displayName: e.target.value })} className="input" />
        </Row>
        <FieldRow label="Legal name *" field="legalName" hasPending={fieldHasPending('legalName')} pendingValue={pendingValueFor('legalName')}>
          <input value={form.legalName || ''} disabled={fieldHasPending('legalName')} onChange={e => setForm({ ...form, legalName: e.target.value })} className="input" />
        </FieldRow>
      </Section>

      <Section title="Compliance">
        <FieldRow label="GSTIN" field="gstin" hasPending={fieldHasPending('gstin')} pendingValue={pendingValueFor('gstin')}>
          <input value={form.gstin || ''} disabled={fieldHasPending('gstin')} onChange={e => setForm({ ...form, gstin: e.target.value })} className="input mono" />
        </FieldRow>
        <FieldRow label="PAN" field="pan" hasPending={fieldHasPending('pan')} pendingValue={pendingValueFor('pan')}>
          <input value={form.pan || ''} disabled={fieldHasPending('pan')} onChange={e => setForm({ ...form, pan: e.target.value })} className="input mono" />
        </FieldRow>
        <FieldRow label="MSME / Udyam" field="msmeNumber" hasPending={fieldHasPending('msmeNumber')} pendingValue={pendingValueFor('msmeNumber')}>
          <input value={form.msmeNumber || ''} disabled={fieldHasPending('msmeNumber')} onChange={e => setForm({ ...form, msmeNumber: e.target.value })} className="input mono" />
        </FieldRow>
      </Section>

      <Section title="Address (GST-registered)">
        <FieldRow label="Address line 1" field="addressLine1" hasPending={fieldHasPending('addressLine1')} pendingValue={pendingValueFor('addressLine1')}>
          <input value={form.addressLine1 || ''} disabled={fieldHasPending('addressLine1')} onChange={e => setForm({ ...form, addressLine1: e.target.value })} className="input" />
        </FieldRow>
        <FieldRow label="Address line 2" field="addressLine2" hasPending={fieldHasPending('addressLine2')} pendingValue={pendingValueFor('addressLine2')}>
          <input value={form.addressLine2 || ''} disabled={fieldHasPending('addressLine2')} onChange={e => setForm({ ...form, addressLine2: e.target.value })} className="input" />
        </FieldRow>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="City" field="city" hasPending={fieldHasPending('city')} pendingValue={pendingValueFor('city')}>
            <input value={form.city || ''} disabled={fieldHasPending('city')} onChange={e => setForm({ ...form, city: e.target.value })} className="input" />
          </FieldRow>
          <FieldRow label="State" field="state" hasPending={fieldHasPending('state')} pendingValue={pendingValueFor('state')}>
            <input value={form.state || ''} disabled={fieldHasPending('state')} onChange={e => setForm({ ...form, state: e.target.value })} className="input" />
          </FieldRow>
          <FieldRow label="Pincode" field="pincode" hasPending={fieldHasPending('pincode')} pendingValue={pendingValueFor('pincode')}>
            <input value={form.pincode || ''} disabled={fieldHasPending('pincode')} onChange={e => setForm({ ...form, pincode: e.target.value })} className="input mono" />
          </FieldRow>
          <Row label="Country">
            <input value={form.country || 'India'} onChange={e => setForm({ ...form, country: e.target.value })} className="input" />
          </Row>
        </div>
      </Section>

      <Section title="Contact">
        <Row label="Contact email" hint="This is your login email. Ask NEEJEE admin to change it.">
          <input value={form.contactEmail} disabled className="input bg-mitti/10" />
        </Row>
        <Row label="Contact person">
          <input value={form.contactPerson || ''} onChange={e => setForm({ ...form, contactPerson: e.target.value })} className="input" />
        </Row>
        <Row label="Contact phone">
          <input value={form.contactPhone || ''} onChange={e => setForm({ ...form, contactPhone: e.target.value })} className="input" />
        </Row>
      </Section>

      {msg && (
        <div className={`p-3 text-sm border ${
          msg.kind === 'ok'  ? 'bg-green-50 border-green-200 text-green-800'
          : msg.kind === 'info' ? 'bg-beige border-mitti/20 text-mitti'
          : 'bg-madder/5 border-madder/30 text-madder'
        }`}>
          {msg.text}
        </div>
      )}

      {requiredDocs && (
        <div className="p-4 bg-haldi/15 border border-haldi text-sm space-y-2">
          <div className="flex items-center gap-2 text-mitti">
            <FileWarning className="w-4 h-4" />
            <strong>Supporting document required</strong>
          </div>
          <p className="text-xs text-mitti">For each sensitive field you're changing, please upload one of:</p>
          <ul className="text-xs text-kohl list-disc pl-5">
            {Object.entries(requiredDocs).map(([f, docs]) => (
              <li key={f}><strong>{f}</strong>: {docs.join(' or ')}</li>
            ))}
          </ul>
          <Link href="/vendor/documents" className="inline-block text-xs uppercase tracking-widest text-madder hover:underline">
            Go to Documents →
          </Link>
        </div>
      )}

      <ChangeRequestSubmit
        onSubmit={save}
        saving={saving}
        formChanged={!!vendor && Object.keys(form).some(k => (vendor as any)[k] !== form[k] && !fieldHasPending(k))}
        hasSensitiveChanges={!!vendor && Object.keys(form).some(k => APPROVAL_GATED.has(k) && (vendor as any)[k] !== form[k] && !fieldHasPending(k))}
      />

      <style jsx>{`
        :global(.input) { padding: 0.5rem; background: #FBF5E8; border: 1px solid rgba(122,105,82,0.2); font-size: 0.875rem; width: 100%; font-family: var(--font-ui, Georgia), serif; }
        :global(.input.mono) { font-family: ui-monospace, SFMono-Regular, monospace; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-ivory border border-mitti/15 p-5 space-y-3">
      <h2 className="font-display text-lg text-kohl uppercase tracking-wider">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-mitti">{label}</span>
      {children}
      {hint && <p className="text-[10px] italic text-mitti/70 mt-1">{hint}</p>}
    </label>
  );
}

function FieldRow({ label, field, hasPending, pendingValue, children }: {
  label: string; field: string; hasPending: boolean; pendingValue: any; children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-mitti flex items-center gap-2">
        {label}
        {hasPending && (
          <span className="inline-flex items-center gap-1 bg-haldi/30 text-mitti px-2 py-0.5 normal-case tracking-normal">
            <Clock className="w-3 h-3" /> Change pending review
          </span>
        )}
      </span>
      {children}
      {hasPending && pendingValue !== null && (
        <p className="text-[10px] text-mitti mt-1">
          Pending new value: <span className="font-mono text-kohl">{String(pendingValue)}</span>
        </p>
      )}
    </label>
  );
}

function ChangeRequestSubmit({ onSubmit, saving, formChanged, hasSensitiveChanges }: {
  onSubmit: (docs: string[], reason?: string) => void;
  saving: boolean;
  formChanged: boolean;
  hasSensitiveChanges: boolean;
}) {
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (showDocPicker) {
      fetch('/api/vendor/documents', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : { documents: [] })
        .then(d => setDocs((d.documents || []).filter((doc: any) => doc.status === 'APPROVED' || doc.status === 'SUBMITTED')));
    }
  }, [showDocPicker]);

  if (!formChanged) {
    return <button disabled className="btn-primary opacity-50 inline-flex items-center gap-2"><Save className="w-4 h-4" /> SAVE</button>;
  }

  if (hasSensitiveChanges) {
    return (
      <>
        <button onClick={() => setShowDocPicker(true)} className="btn-primary inline-flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> SUBMIT FOR APPROVAL
        </button>
        {showDocPicker && (
          <div className="fixed inset-0 bg-kohl/40 z-50 flex items-center justify-center p-4">
            <div className="bg-ivory max-w-lg w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
              <h2 className="font-display text-2xl text-kohl">Attach supporting documents</h2>
              <p className="text-xs text-mitti">
                Sensitive changes need at least one supporting document so the NEEJEE finance team can verify before the change takes effect.
                Don't have one uploaded yet? <Link href="/vendor/documents" className="text-madder underline">Upload here</Link>.
              </p>
              {docs.length === 0 ? (
                <div className="p-4 bg-beige text-xs text-mitti">No documents uploaded yet.</div>
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
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-mitti">Reason (optional)</span>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowDocPicker(false)} className="btn-ghost text-xs">Cancel</button>
                <button
                  disabled={saving || selected.length === 0}
                  onClick={() => { onSubmit(selected, reason); setShowDocPicker(false); }}
                  className="btn-primary text-xs inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  SUBMIT REQUEST
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <button disabled={saving} onClick={() => onSubmit([])} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} SAVE
    </button>
  );
}
