'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, AlertCircle } from 'lucide-react';
import { SingleImageInput } from '@/components/admin/SingleImageInput';

type Seller = any;

const GATED = ['businessName', 'pan', 'gstin', 'region'];

export default function ProfilePage() {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [form, setForm] = useState<any>({});
  const [original, setOriginal] = useState<any>({});
  const [docs, setDocs] = useState<any[]>([]);
  const [pickedDocs, setPickedDocs] = useState<string[]>([]);
  const [reason, setReason] = useState('');
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
    setSeller(pJ.seller);
    setForm(pJ.seller || {});
    setOriginal(pJ.seller || {});
    setDocs(dJ.documents || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const changedGated = GATED.filter(k => form[k] !== original[k] && original[k]);
  const needsApproval = changedGated.length > 0;

  const submit = async () => {
    setErr(''); setMsg(''); setSaving(true);
    try {
      const changes: Record<string, any> = {};
      for (const k of Object.keys(form)) {
        if (form[k] !== original[k]) changes[k] = form[k];
      }
      if (Object.keys(changes).length === 0) {
        setMsg('No changes to save'); setSaving(false); return;
      }
      const r = await fetch('/api/seller/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes, supportingDocIds: pickedDocs, reason }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(j.message || 'Saved');
      setReason(''); setPickedDocs([]);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;
  if (!seller) return <div className="text-mitti">No profile</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl text-kohl">Studio Profile</h1>
        <p className="text-mitti text-sm">Public details, compliance & bank info</p>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}
      {err && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

      {/* Public details (direct edit) */}
      <Section title="Public Studio">
        <FieldRow label="Studio name (legal)" gated>
          <Input value={form.businessName} onChange={v => setForm({ ...form, businessName: v })} />
        </FieldRow>
        <FieldRow label="Contact person">
          <Input value={form.contactName || ''} onChange={v => setForm({ ...form, contactName: v })} />
        </FieldRow>
        <FieldRow label="Phone">
          <Input value={form.phone || ''} onChange={v => setForm({ ...form, phone: v })} />
        </FieldRow>
        <FieldRow label="Story (300-500 words)">
          <textarea value={form.story || ''} onChange={e => setForm({ ...form, story: e.target.value })}
            rows={5} className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
        </FieldRow>
        <FieldRow label="Craft & cluster">
          <div className="flex gap-2">
            <Input value={form.craft || ''} onChange={v => setForm({ ...form, craft: v })} placeholder="e.g. Banarasi weaving" />
            <Input value={form.cluster || ''} onChange={v => setForm({ ...form, cluster: v })} placeholder="e.g. Varanasi" />
          </div>
        </FieldRow>
        <FieldRow label="Years of practice">
          <Input type="number" value={String(form.yearsOfPractice || '')} onChange={v => setForm({ ...form, yearsOfPractice: parseInt(v) || null })} />
        </FieldRow>
        <FieldRow label="Studio logo">
          <SingleImageInput value={form.logoImage || ''} onChange={v => setForm({ ...form, logoImage: v })}
            folder="sellers/logos" label="LOGO" recommendedSize="500 × 500 px" />
        </FieldRow>
        <FieldRow label="Cover image">
          <SingleImageInput value={form.coverImage || ''} onChange={v => setForm({ ...form, coverImage: v })}
            folder="sellers/covers" label="COVER" recommendedSize="1600 × 800 px" recommendedAspect="2:1" />
        </FieldRow>
      </Section>

      {/* Compliance (approval-gated) */}
      <Section title="Compliance" subtitle="Edits to these fields require admin approval">
        <FieldRow label="PAN" gated>
          <Input value={form.pan || ''} onChange={v => setForm({ ...form, pan: v?.toUpperCase() })} placeholder="ABCDE1234F" />
        </FieldRow>
        <FieldRow label="GSTIN" gated>
          <Input value={form.gstin || ''} onChange={v => setForm({ ...form, gstin: v?.toUpperCase() })} placeholder="22ABCDE1234F1Z5" />
        </FieldRow>
        <FieldRow label="Region / state" gated>
          <Input value={form.region || ''} onChange={v => setForm({ ...form, region: v })} placeholder="e.g. Uttar Pradesh" />
        </FieldRow>
      </Section>

      {/* If gated fields changed, show approval modal-style block */}
      {needsApproval && (
        <div className="bg-banarasi/10 border border-banarasi/40 p-5 rounded">
          <div className="flex items-start gap-3 mb-3">
            <AlertCircle className="w-5 h-5 text-banarasi mt-0.5" />
            <div>
              <h4 className="font-display text-kohl">These changes need admin approval</h4>
              <p className="text-mitti text-sm">
                Changed: <strong>{changedGated.join(', ')}</strong>. Please attach a supporting document.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <p className="label text-banarasi mb-2">SUPPORTING DOCUMENT(S)</p>
            {docs.length === 0 ? (
              <p className="text-mitti text-sm italic">No documents uploaded yet — go to Documents page first.</p>
            ) : (
              <div className="space-y-1">
                {docs.filter(d => d.status !== 'REJECTED').map(d => (
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
          <div className="mt-3">
            <p className="label text-banarasi mb-1">REASON (optional)</p>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. New GST registration"
              className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
          </div>
        </div>
      )}

      <div className="flex gap-2 sticky bottom-4 bg-ivory border border-mitti/20 p-3 rounded shadow-lg">
        <button onClick={submit} disabled={saving}
          className="bg-kohl text-ivory px-6 py-2.5 font-ui text-xs tracking-widest flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {needsApproval ? 'SUBMIT FOR APPROVAL' : 'SAVE CHANGES'}
        </button>
        <button onClick={() => setForm({ ...original })} disabled={saving}
          className="border border-kohl text-kohl px-6 py-2.5 font-ui text-xs tracking-widest">
          RESET
        </button>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-ivory border border-mitti/20 p-6 rounded">
      <h3 className="font-display text-xl text-kohl">{title}</h3>
      {subtitle && <p className="text-mitti text-xs mt-0.5 mb-4">{subtitle}</p>}
      <div className="space-y-4 mt-4">{children}</div>
    </div>
  );
}

function FieldRow({ label, gated, children }: { label: string; gated?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="label text-banarasi mb-1.5 flex items-center gap-2">
        {label}
        {gated && <span className="text-[9px] tracking-widest bg-banarasi/10 text-banarasi px-1.5 py-0.5 rounded">APPROVAL GATED</span>}
      </p>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
  );
}
