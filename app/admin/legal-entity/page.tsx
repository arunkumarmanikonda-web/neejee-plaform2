'use client';
import { useEffect, useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { SingleImageInput } from '@/components/admin/SingleImageInput';

export default function LegalEntityPage() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/legal-entity', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.entity) setForm(d.entity);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/admin/legal-entity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      // Defensive parse: read raw text first, then try JSON. This protects
      // against middleware redirects (HTML) or empty bodies.
      const text = await r.text();
      let d: any = null;
      try { d = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
      if (!r.ok) {
        const err = d?.error || (r.status === 401 ? 'Please sign in again' : r.status === 403 ? 'You don\'t have permission' : `Save failed (HTTP ${r.status})`);
        throw new Error(err);
      }
      if (d?.entity) setForm(d.entity);
      setMsg({ kind: 'ok', text: 'Saved.' });
    } catch (err: any) {
      setMsg({ kind: 'err', text: err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 lg:p-8">
      <h1 className="font-display text-3xl text-kohl mb-2">Legal Entity</h1>
      <p className="text-sm text-mitti mb-6">
        The legal entity that operates the NEEJEE brand. Used on invoices, T&amp;C, GST returns.
      </p>

      <form onSubmit={onSave} className="space-y-8">
        <Section title="Identity">
          <Field label="Legal name *" value={form.legalName} onChange={v => setForm({ ...form, legalName: v })} required />
          <Field label="Brand name (display)" value={form.brandName} onChange={v => setForm({ ...form, brandName: v })} />
          <Field label="GSTIN" value={form.gstin} onChange={v => setForm({ ...form, gstin: v })} mono />
          <Field label="PAN" value={form.pan} onChange={v => setForm({ ...form, pan: v })} mono />
          <Field label="CIN (if private/public ltd)" value={form.cinNumber} onChange={v => setForm({ ...form, cinNumber: v })} mono />
          <Field label="MSME / Udyam Reg." value={form.msmeNumber} onChange={v => setForm({ ...form, msmeNumber: v })} mono />
        </Section>

        <Section title="Registered Address">
          <Field label="Address line 1" value={form.addressLine1} onChange={v => setForm({ ...form, addressLine1: v })} />
          <Field label="Address line 2" value={form.addressLine2} onChange={v => setForm({ ...form, addressLine2: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" value={form.city} onChange={v => setForm({ ...form, city: v })} />
            <Field label="State" value={form.state} onChange={v => setForm({ ...form, state: v })} />
            <Field label="Pincode" value={form.pincode} onChange={v => setForm({ ...form, pincode: v })} />
            <Field label="Country" value={form.country} onChange={v => setForm({ ...form, country: v })} />
          </div>
        </Section>

        <Section title="Bank Account (for incoming settlements)">
          <Field label="Account holder" value={form.bankAccountName} onChange={v => setForm({ ...form, bankAccountName: v })} />
          <Field label="Account number" value={form.bankAccountNumber} onChange={v => setForm({ ...form, bankAccountNumber: v })} mono />
          <Field label="IFSC" value={form.bankIfsc} onChange={v => setForm({ ...form, bankIfsc: v })} mono />
          <Field label="Bank name" value={form.bankName} onChange={v => setForm({ ...form, bankName: v })} />
          <Field label="Branch" value={form.bankBranch} onChange={v => setForm({ ...form, bankBranch: v })} />
        </Section>

        <Section title="Finance Contact &amp; Authorised Signatory (PRIVATE)">
          <div className="bg-madder/10 border-l-4 border-madder p-3 text-xs text-kohl mb-3">
            <strong>Private — NEVER shown publicly.</strong> These details appear on invoices, POs, GST filings,
            payslips, and TDS certificates. The signatory&apos;s personal phone &amp; email should NOT be exposed on the website.
            For the public website contact, use the “Public Website Contact” section below.
          </div>
          <Field label="Finance / signatory email" value={form.contactEmail} onChange={v => setForm({ ...form, contactEmail: v })} placeholder="e.g. nidhi@neejee.com" />
          <Field label="Finance / signatory phone" value={form.contactPhone} onChange={v => setForm({ ...form, contactPhone: v })} placeholder="e.g. +91 ..." />
          <Field label="Authorised signatory" value={form.authorisedSignatory} onChange={v => setForm({ ...form, authorisedSignatory: v })} />
          <Field label="Signatory title" value={form.signatoryTitle} onChange={v => setForm({ ...form, signatoryTitle: v })} placeholder="e.g. Director, Proprietor" />
          <SingleImageInput
            value={form.logoUrl || ''}
            onChange={v => setForm({ ...form, logoUrl: v })}
            folder="legal-entity"
            label="LOGO"
            recommendedSize="600 × 200 px (or larger)"
            recommendedAspect="3:1 landscape, transparent PNG preferred"
            maxSizeMB={2}
          />
          <SingleImageInput
            value={form.signatureUrl || ''}
            onChange={v => setForm({ ...form, signatureUrl: v })}
            folder="legal-entity"
            label="AUTHORISED SIGNATURE"
            recommendedSize="400 × 150 px"
            recommendedAspect="transparent PNG, black ink on white"
            maxSizeMB={1}
          />
        </Section>

        {/* v23.40.25.2 — Public website contact, SEPARATE from finance/signatory */}
        <Section title="Public Website Contact (shown publicly)">
          <div className="bg-neem/10 border-l-4 border-neem p-3 text-xs text-kohl mb-3">
            <strong>Public — shown on the website footer, /help/contact, /contact, etc.</strong>
            Use a shared inbox and a non-personal phone (or your support WhatsApp). Edits here propagate to the
            UI within ~60s without redeploy.
          </div>
          <Field label="Public email" value={form.publicEmail || ''} onChange={v => setForm({ ...form, publicEmail: v })} placeholder="e.g. hello@neejee.com" />
          <Field label="Public phone" value={form.publicPhone || ''} onChange={v => setForm({ ...form, publicPhone: v })} placeholder="e.g. +91 98765 12345" />
          <Field label="Public WhatsApp number" value={form.publicWhatsapp || ''} onChange={v => setForm({ ...form, publicWhatsapp: v })} placeholder="defaults to Public phone if blank" />
          <Field label="Public display address (optional)" value={form.publicAddressLine || ''} onChange={v => setForm({ ...form, publicAddressLine: v })} placeholder="e.g. Mumbai · Varanasi · Jaipur" />
          <Field label="Instagram URL (optional)" value={form.socialInstagram || ''} onChange={v => setForm({ ...form, socialInstagram: v })} placeholder="https://instagram.com/neejee" />
        </Section>

        <Section title="Tax Configuration">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={form.gstEnabled !== false} onChange={e => setForm({ ...form, gstEnabled: e.target.checked })} />
            GST enabled (collect &amp; remit GST on sales)
          </label>
          <Field
            label="Default GST rate (%)"
            value={form.defaultGstRate?.toString() || '5'}
            onChange={v => setForm({ ...form, defaultGstRate: parseFloat(v) || 0 })}
            mono
          />
        </Section>

        {msg && (
          <div className={`p-3 text-sm border ${msg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || !form.legalName}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-mitti/15 p-5 bg-ivory">
      <h2 className="font-display text-lg text-kohl mb-4 uppercase tracking-wider">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, mono, required, placeholder }: {
  label: string; value: string | undefined; onChange: (v: string) => void;
  mono?: boolean; required?: boolean; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-mitti">{label}</span>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={`mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm ${mono ? 'font-mono' : 'font-ui'}`}
      />
    </label>
  );
}
