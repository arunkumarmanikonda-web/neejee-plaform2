'use client';
// v23.40.11 — Manual customer creation form.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export default function NewCustomerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: '',
    legalName: '',
    primaryEmail: '',
    primaryPhone: '',
    gstin: '',
    pan: '',
    placeOfSupply: '',
    billingAddress: '',
    shippingAddress: '',
    customerType: 'INDIVIDUAL',
    channel: 'WEBSITE',
    creditLimitRupees: '',
    creditDays: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr(''); setSaving(true);
    try {
      if (!form.displayName.trim()) throw new Error('Display name is required');
      const r = await fetch('/api/admin/finance/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          creditLimitPaise: Math.round(parseFloat(form.creditLimitRupees || '0') * 100),
          creditDays: parseInt(form.creditDays) || 0,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      router.push(`/admin/finance/customer-ledger/${j.customer.id}`);
    } catch (e: any) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/admin/finance/customer-ledger"
        className="inline-flex items-center gap-1 text-xs text-banarasi hover:text-madder mb-3">
        <ArrowLeft className="w-3 h-3" /> Back to customer ledgers
      </Link>
      <h1 className="font-display text-3xl text-kohl mb-6">New customer</h1>

      <div className="bg-ivory border border-mitti/30 p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="DISPLAY NAME *" value={form.displayName} onChange={v => setForm({ ...form, displayName: v })} placeholder="Acme Pvt Ltd / Ravi Kumar" />
        <Field label="LEGAL NAME" value={form.legalName} onChange={v => setForm({ ...form, legalName: v })} placeholder="for B2B invoices" />
        <Field label="PHONE" value={form.primaryPhone} onChange={v => setForm({ ...form, primaryPhone: v })} placeholder="+91 9999999999" />
        <Field label="EMAIL" value={form.primaryEmail} onChange={v => setForm({ ...form, primaryEmail: v })} />
        <Field label="GSTIN" value={form.gstin} onChange={v => setForm({ ...form, gstin: v.toUpperCase() })} placeholder="29ABCDE1234F1Z5" />
        <Field label="PAN" value={form.pan} onChange={v => setForm({ ...form, pan: v.toUpperCase() })} placeholder="ABCDE1234F" />
        <Field label="PLACE OF SUPPLY" value={form.placeOfSupply} onChange={v => setForm({ ...form, placeOfSupply: v.toUpperCase() })} placeholder="27 (state code)" />
        <div>
          <p className="label text-banarasi mb-1">TYPE</p>
          <select value={form.customerType} onChange={e => setForm({ ...form, customerType: e.target.value })}
            className="w-full bg-ivory border border-mitti/30 px-3 py-1.5 text-sm">
            <option value="INDIVIDUAL">Individual</option>
            <option value="B2B">B2B</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="INTERNAL">Internal</option>
          </select>
        </div>
        <div>
          <p className="label text-banarasi mb-1">CHANNEL</p>
          <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}
            className="w-full bg-ivory border border-mitti/30 px-3 py-1.5 text-sm">
            <option value="WEBSITE">Website</option>
            <option value="POS">POS / Offline</option>
            <option value="BULK">Bulk</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="REFERRAL">Referral</option>
          </select>
        </div>
        <Field label="CREDIT LIMIT (₹)" value={form.creditLimitRupees} onChange={v => setForm({ ...form, creditLimitRupees: v })} placeholder="0 = no credit" />
        <Field label="CREDIT DAYS" value={form.creditDays} onChange={v => setForm({ ...form, creditDays: v })} placeholder="0 / 7 / 15 / 30" />
        <div className="md:col-span-2">
          <p className="label text-banarasi mb-1">BILLING ADDRESS</p>
          <textarea value={form.billingAddress} onChange={e => setForm({ ...form, billingAddress: e.target.value })}
            className="w-full bg-ivory border border-mitti/30 px-3 py-2 text-sm" rows={2} />
        </div>
        <div className="md:col-span-2">
          <p className="label text-banarasi mb-1">SHIPPING ADDRESS</p>
          <textarea value={form.shippingAddress} onChange={e => setForm({ ...form, shippingAddress: e.target.value })}
            className="w-full bg-ivory border border-mitti/30 px-3 py-2 text-sm" rows={2} />
        </div>
        <div className="md:col-span-2">
          <p className="label text-banarasi mb-1">NOTES</p>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full bg-ivory border border-mitti/30 px-3 py-2 text-sm" rows={2} />
        </div>

        {err && <p className="md:col-span-2 text-madder text-xs bg-madder/10 border border-madder/30 p-2">{err}</p>}

        <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-mitti/10">
          <Link href="/admin/finance/customer-ledger"
            className="px-4 py-1.5 border border-mitti text-mitti text-xs tracking-widest hover:bg-mitti hover:text-ivory">
            CANCEL
          </Link>
          <button onClick={submit} disabled={saving}
            className="inline-flex items-center gap-1 px-4 py-1.5 bg-kohl text-ivory text-xs tracking-widest hover:bg-madder disabled:opacity-50">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            CREATE CUSTOMER
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-ivory border border-mitti/30 px-3 py-1.5 text-sm focus:border-madder outline-none" />
    </div>
  );
}
