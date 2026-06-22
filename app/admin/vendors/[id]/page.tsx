'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Loader2, Send, ArrowLeft, Copy, Archive } from 'lucide-react';

export default function VendorEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = String((params as any).id);
  const [vendor, setVendor] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    fetch(`/api/admin/vendors/${id}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.vendor) { setVendor(d.vendor); setForm(d.vendor); } setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/vendors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Save failed');
      setVendor(d.vendor); setMsg({ kind: 'ok', text: 'Saved.' });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally { setSaving(false); }
  };

  const invite = async () => {
    const r = await fetch(`/api/admin/vendors/${id}/invite`, { method: 'POST' });
    const text = await r.text();
    let d: any = null;
    try { d = text ? JSON.parse(text) : null; } catch {}
    if (r.ok && d?.loginUrl) {
      setInviteUrl(d.loginUrl);
      const emailNote = d.emailSent && !d.emailDevMode
        ? `Magic link emailed to ${d.vendorEmail}. You can also copy it below as a backup.`
        : d.emailDevMode
          ? `Email service is in dev mode (RESEND_API_KEY not set). Copy the link below and share manually for now.`
          : `Magic link generated, but the email could not be sent. Copy and share manually.`;
      setMsg({ kind: 'ok', text: emailNote });
    } else {
      setMsg({ kind: 'err', text: d?.error || `Could not generate invite (HTTP ${r.status})` });
    }
  };

  const archive = async () => {
    if (!confirm('Archive this vendor? They will no longer appear in active lists.')) return;
    const r = await fetch(`/api/admin/vendors/${id}`, { method: 'DELETE' });
    if (r.ok) router.push('/admin/vendors');
  };

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;
  if (!vendor) return <div className="p-8 text-sm text-madder">Vendor not found.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      <Link href="/admin/vendors" className="inline-flex items-center gap-1 text-xs text-mitti hover:text-madder mb-4">
        <ArrowLeft className="w-3 h-3" /> All vendors
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">{vendor.legalName}</h1>
          <p className="text-xs text-mitti mt-1">
            Status: <strong>{vendor.status}</strong> · {vendor._count?.purchaseOrders ?? 0} POs · {vendor._count?.purchaseCosts ?? 0} cost entries
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/vendors/${id}/catalog`} className="btn-ghost text-xs inline-flex items-center gap-1">
            RATE CARD
          </Link>
          <button onClick={invite} className="btn-ghost text-xs inline-flex items-center gap-1">
            <Send className="w-3 h-3" /> SEND MAGIC LINK
          </button>
          <button onClick={archive} className="btn-ghost text-xs text-madder inline-flex items-center gap-1">
            <Archive className="w-3 h-3" /> ARCHIVE
          </button>
        </div>
      </div>

      {inviteUrl && (
        <div className="bg-haldi/15 border border-haldi p-3 mb-6 text-xs">
          <p className="font-ui uppercase tracking-widest text-mitti mb-2">Share this link with the vendor</p>
          <div className="flex items-center gap-2">
            <input readOnly value={inviteUrl} className="flex-1 p-2 bg-ivory border border-mitti/20 font-mono text-xs" />
            <button
              onClick={() => { navigator.clipboard.writeText(inviteUrl); setMsg({ kind: 'ok', text: 'Copied.' }); }}
              className="btn-ghost text-xs inline-flex items-center gap-1"
            >
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <p className="text-[10px] italic text-mitti mt-2">Link valid for 24 hours. Vendor will be asked to set a password OR keep magic-link-only sign-in.</p>
        </div>
      )}

      <Section title="Profile">
        <Row label="Legal name *"><Input value={form.legalName} onChange={v => setForm({ ...form, legalName: v })} /></Row>
        <Row label="Display name"><Input value={form.displayName} onChange={v => setForm({ ...form, displayName: v })} /></Row>
        <Row label="Contact person"><Input value={form.contactPerson} onChange={v => setForm({ ...form, contactPerson: v })} /></Row>
        <Row label="Contact email *"><Input value={form.contactEmail} onChange={v => setForm({ ...form, contactEmail: v })} /></Row>
        <Row label="Contact phone"><Input value={form.contactPhone} onChange={v => setForm({ ...form, contactPhone: v })} /></Row>
        <Row label="Status">
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="p-2 bg-beige border border-mitti/20 text-sm">
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </Row>
      </Section>

      <Section title="Compliance">
        <Row label="GSTIN"><Input mono value={form.gstin} onChange={v => setForm({ ...form, gstin: v })} /></Row>
        <Row label="PAN"><Input mono value={form.pan} onChange={v => setForm({ ...form, pan: v })} /></Row>
        <Row label="MSME / Udyam"><Input mono value={form.msmeNumber} onChange={v => setForm({ ...form, msmeNumber: v })} /></Row>
      </Section>

      <Section title="Address">
        <Row label="Address line 1"><Input value={form.addressLine1} onChange={v => setForm({ ...form, addressLine1: v })} /></Row>
        <Row label="Address line 2"><Input value={form.addressLine2} onChange={v => setForm({ ...form, addressLine2: v })} /></Row>
        <Row label="City"><Input value={form.city} onChange={v => setForm({ ...form, city: v })} /></Row>
        <Row label="State"><Input value={form.state} onChange={v => setForm({ ...form, state: v })} /></Row>
        <Row label="Pincode"><Input value={form.pincode} onChange={v => setForm({ ...form, pincode: v })} /></Row>
      </Section>

      <Section title="Bank (for payouts)">
        <Row label="Account holder"><Input value={form.bankAccountName} onChange={v => setForm({ ...form, bankAccountName: v })} /></Row>
        <Row label="Account number"><Input mono value={form.bankAccountNumber} onChange={v => setForm({ ...form, bankAccountNumber: v })} /></Row>
        <Row label="IFSC"><Input mono value={form.bankIfsc} onChange={v => setForm({ ...form, bankIfsc: v })} /></Row>
        <Row label="Bank name"><Input value={form.bankName} onChange={v => setForm({ ...form, bankName: v })} /></Row>
      </Section>

      <Section title="Commercial">
        <Row label="Payment terms (days)"><Input mono value={String(form.paymentTermsDays ?? 30)} onChange={v => setForm({ ...form, paymentTermsDays: Number(v) || 0 })} /></Row>
        <Row label="Default lead time (days)"><Input mono value={String(form.defaultLeadTimeDays ?? 14)} onChange={v => setForm({ ...form, defaultLeadTimeDays: Number(v) || 0 })} /></Row>
        <Row label="Notes"><textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full p-2 bg-beige border border-mitti/20 text-sm font-ui" /></Row>
      </Section>

      {msg && (
        <div className={`p-3 mt-4 text-sm border ${msg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
          {msg.text}
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 mt-6 disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        SAVE CHANGES
      </button>

      <VendorDocsSection vendorId={id} />
    </div>
  );
}

// ─────────── Vendor documents widget (admin can upload on behalf) ───────────
function VendorDocsSection({ vendorId }: { vendorId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('PAN_CARD');
  const [autoApprove, setAutoApprove] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/vendors/${vendorId}/documents`, { cache: 'no-store' });
    const d = await r.json();
    setDocs(d.documents || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [vendorId]);

  const upload = async (file: File) => {
    setUploading(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('docType', docType);
      fd.append('autoApprove', String(autoApprove));
      const r = await fetch(`/api/admin/vendors/${vendorId}/documents`, { method: 'POST', body: fd, credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Upload failed');
      setMsg(`Uploaded on behalf of vendor: ${file.name}`);
      await load();
    } catch (e: any) { setMsg(e.message); } finally { setUploading(false); }
  };

  const review = async (docId: string, action: 'APPROVE' | 'REJECT') => {
    const note = action === 'REJECT' ? prompt('Reason for rejection (optional):') || '' : '';
    setBusyId(docId);
    try {
      const r = await fetch(`/api/admin/vendors/${vendorId}/documents`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, action, note }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d?.error || 'Failed'); return; }
      await load();
    } finally { setBusyId(null); }
  };

  return (
    <section className="border border-mitti/15 p-5 bg-ivory mt-6">
      <h2 className="font-display text-lg text-kohl mb-4 uppercase tracking-wider">Documents</h2>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-xs">
          <span className="block text-[10px] uppercase tracking-widest text-mitti mb-1">Doc type</span>
          <select value={docType} onChange={e => setDocType(e.target.value)} className="p-2 bg-beige border border-mitti/20 text-sm font-ui">
            <option value="PAN_CARD">PAN card</option>
            <option value="GST_CERTIFICATE">GST certificate</option>
            <option value="MSME_CERTIFICATE">MSME / Udyam</option>
            <option value="CANCELLED_CHEQUE">Cancelled cheque</option>
            <option value="BANK_STATEMENT">Bank statement</option>
            <option value="ADDRESS_PROOF">Address proof</option>
            <option value="AADHAAR_SIGNATORY">Aadhaar (signatory)</option>
            <option value="SIGNATORY_PHOTO">Signatory photo</option>
            <option value="VENDOR_AGREEMENT">Vendor agreement</option>
            <option value="INVOICE">Invoice</option>
            <option value="GRN_DISPUTE">GRN dispute</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="text-xs inline-flex items-center gap-2 pb-2">
          <input type="checkbox" checked={autoApprove} onChange={e => setAutoApprove(e.target.checked)} />
          Auto-approve on upload
        </label>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-ghost text-xs inline-flex items-center gap-1 disabled:opacity-50">
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : null} UPLOAD ON BEHALF
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>

      {msg && <p className="text-xs text-mitti mb-3">{msg}</p>}

      {loading ? <Loader2 className="w-4 h-4 animate-spin text-madder" /> : docs.length === 0 ? (
        <p className="text-xs italic text-mitti">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(d => (
            <li key={d.id} className="flex items-center gap-3 border-t border-mitti/10 py-2 text-sm">
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="flex-1 text-kohl hover:text-madder truncate">{d.fileName}</a>
              <span className="text-[10px] uppercase tracking-widest text-mitti">{d.docType.replace(/_/g, ' ')}</span>
              <span className="text-[10px] uppercase tracking-widest px-2 py-1 " style={{
                background: d.status === 'APPROVED' ? '#dcfce7' : d.status === 'REJECTED' ? 'rgba(159,43,60,0.1)' : 'rgba(212,175,55,0.2)',
                color: d.status === 'APPROVED' ? '#166534' : d.status === 'REJECTED' ? '#9F2B3C' : '#7A6952',
              }}>{d.status}</span>
              {d.status === 'SUBMITTED' && (
                <>
                  <button onClick={() => review(d.id, 'APPROVE')} disabled={busyId === d.id} className="text-xs uppercase tracking-widest text-green-700 hover:underline disabled:opacity-50">Approve</button>
                  <button onClick={() => review(d.id, 'REJECT')} disabled={busyId === d.id} className="text-xs uppercase tracking-widest text-madder hover:underline disabled:opacity-50">Reject</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-mitti/15 p-5 bg-ivory mb-4">
      <h2 className="font-display text-lg text-kohl mb-4 uppercase tracking-wider">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-1 md:grid-cols-3 gap-2 items-start">
      <span className="text-[10px] uppercase tracking-widest text-mitti pt-2">{label}</span>
      <div className="md:col-span-2">{children}</div>
    </label>
  );
}

function Input({ value, onChange, mono }: { value?: string; onChange: (v: string) => void; mono?: boolean }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      className={`w-full p-2 bg-beige border border-mitti/20 text-sm ${mono ? 'font-mono' : 'font-ui'}`}
    />
  );
}
