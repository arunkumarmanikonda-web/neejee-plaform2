'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Loader2 } from 'lucide-react';

type Vendor = {
  id: string;
  legalName: string;
  displayName: string | null;
  contactEmail: string;
  contactPhone: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  status: string;
  paymentTermsDays: number;
  createdAt: string;
  _count: { purchaseOrders: number };
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const url = new URL('/api/admin/vendors', window.location.origin);
    if (q) url.searchParams.set('q', q);
    if (statusFilter) url.searchParams.set('status', statusFilter);
    const r = await fetch(url.toString(), { cache: 'no-store' });
    const d = await r.json();
    setVendors(d.vendors || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Vendors</h1>
          <p className="text-sm text-mitti mt-1">Suppliers we purchase inventory from.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> NEW VENDOR
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <form onSubmit={e => { e.preventDefault(); load(); }} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-mitti absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by name / email / GSTIN"
              className="pl-8 pr-3 py-2 bg-beige border border-mitti/20 text-sm font-ui w-72"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-beige border border-mitti/20 text-sm font-ui"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button type="submit" className="btn-ghost text-xs uppercase tracking-widest">Apply</button>
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-madder" />
      ) : vendors.length === 0 ? (
        <p className="text-sm text-mitti italic">No vendors yet.</p>
      ) : (
        <div className="overflow-x-auto border border-mitti/15 bg-ivory">
          <table className="w-full text-sm">
            <thead className="bg-beige text-[10px] uppercase tracking-widest text-mitti">
              <tr>
                <th className="text-left p-3">Vendor</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">GSTIN</th>
                <th className="text-left p-3">Location</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">POs</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {vendors.map(v => (
                <tr key={v.id} className="border-t border-mitti/10 hover:bg-beige/40">
                  <td className="p-3">
                    <div className="font-display text-kohl">{v.legalName}</div>
                    {v.displayName && <div className="text-xs text-mitti">{v.displayName}</div>}
                  </td>
                  <td className="p-3 text-xs">{v.contactEmail}</td>
                  <td className="p-3 font-mono text-xs">{v.gstin || '—'}</td>
                  <td className="p-3 text-xs">{[v.city, v.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="p-3"><StatusPill status={v.status} /></td>
                  <td className="p-3 text-right">{v._count.purchaseOrders}</td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/vendors/${v.id}`} className="text-xs uppercase tracking-widest text-madder hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateVendorModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:   'bg-haldi/20 text-mitti',
    ACTIVE:    'bg-green-100 text-green-800',
    SUSPENDED: 'bg-madder/10 text-madder',
    ARCHIVED:  'bg-mitti/15 text-mitti',
  };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 ${styles[status] || ''}`}>{status}</span>;
}

function CreateVendorModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<any>({ country: 'India', paymentTermsDays: 30, defaultLeadTimeDays: 14 });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setSaving(true);
    try {
      const r = await fetch('/api/admin/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Create failed');
      onCreated();
    } catch (e: any) {
      setErr(e.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-kohl/40 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-ivory max-w-lg w-full p-6 space-y-3 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-2xl text-kohl">New vendor</h2>
        <Input label="Legal name *" value={form.legalName} onChange={v => setForm({ ...form, legalName: v })} required />
        <Input label="Display name" value={form.displayName} onChange={v => setForm({ ...form, displayName: v })} />
        <Input label="Contact email *" value={form.contactEmail} onChange={v => setForm({ ...form, contactEmail: v })} required type="email" />
        <Input label="Contact person" value={form.contactPerson} onChange={v => setForm({ ...form, contactPerson: v })} />
        <Input label="Contact phone" value={form.contactPhone} onChange={v => setForm({ ...form, contactPhone: v })} />
        <Input label="GSTIN" value={form.gstin} onChange={v => setForm({ ...form, gstin: v })} mono />
        <Input label="PAN" value={form.pan} onChange={v => setForm({ ...form, pan: v })} mono />
        <Input label="City" value={form.city} onChange={v => setForm({ ...form, city: v })} />
        <Input label="State" value={form.state} onChange={v => setForm({ ...form, state: v })} />
        {err && <p className="text-xs text-madder">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost text-xs">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-xs disabled:opacity-50">
            {saving ? 'Creating…' : 'CREATE'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, mono, required, type }: { label: string; value?: string; onChange: (v: string) => void; mono?: boolean; required?: boolean; type?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-mitti">{label}</span>
      <input
        type={type || 'text'}
        value={value || ''}
        required={required}
        onChange={e => onChange(e.target.value)}
        className={`mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm ${mono ? 'font-mono' : 'font-ui'}`}
      />
    </label>
  );
}
