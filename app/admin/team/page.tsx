'use client';
import { useEffect, useState } from 'react';
import { Plus, X, Save, Trash2, Shield } from 'lucide-react';

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Full access including team management' },
  { value: 'ADMIN', label: 'Admin', desc: 'Manage products, orders, customers' },
  { value: 'CONTENT_EDITOR', label: 'Content Editor', desc: 'Manage products, CMS, journal' },
  { value: 'QC_TEAM', label: 'QC Team', desc: 'Quality control on incoming/returned products' },
  { value: 'SELLER', label: 'Seller', desc: 'Marketplace seller (limited to their own catalog)' },
];

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: 'bg-madder', ADMIN: 'bg-kohl', CONTENT_EDITOR: 'bg-banarasi',
  QC_TEAM: 'bg-ajrakh', SELLER: 'bg-mitti',
};

export default function AdminTeamPage() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/team');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTeam(d.team || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the team? Their account becomes a CUSTOMER account.`)) return;
    try {
      const res = await fetch(`/api/admin/team/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <div>
          <p className="label text-madder">PEOPLE · INTERNAL</p>
          <h1 className="font-display text-4xl text-kohl mt-2">Team & Roles</h1>
          <p className="font-italic italic text-mitti mt-2">{team.length} staff members</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> ADD TEAM MEMBER
        </button>
      </div>
      <div className="madder-divider mt-4"></div>

      {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

      <table className="w-full mt-8 bg-beige font-ui text-sm">
        <thead>
          <tr className="border-b border-mitti/20 text-left text-xs tracking-widest text-mitti">
            <th className="p-4">NAME</th>
            <th className="p-4">EMAIL</th>
            <th className="p-4">PHONE</th>
            <th className="p-4">ROLE</th>
            <th className="p-4">JOINED</th>
            <th className="p-4"></th>
          </tr>
        </thead>
        <tbody>
          {loading && <tr><td colSpan={6} className="p-8 text-center text-mitti">Loading...</td></tr>}
          {!loading && team.length === 0 && (
            <tr><td colSpan={6} className="p-8 text-center text-mitti italic">No staff yet.</td></tr>
          )}
          {team.map(m => (
            <tr key={m.id} className="border-b border-mitti/10 hover:bg-ivory/50">
              <td className="p-4 font-medium">{m.name || '—'}</td>
              <td className="p-4 text-monsoon">{m.email}</td>
              <td className="p-4 text-monsoon text-xs">{m.phone || '—'}</td>
              <td className="p-4">
                <span className={`badge-founder ${ROLE_COLOR[m.role] || 'bg-mitti'}`}>
                  {m.role.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="p-4 text-xs text-mitti">{new Date(m.createdAt).toLocaleDateString('en-IN')}</td>
              <td className="p-4 text-right">
                <button onClick={() => remove(m.id, m.name || m.email)} className="text-monsoon hover:text-madder">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-12 bg-beige p-6">
        <p className="label text-madder mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> ROLE PERMISSIONS
        </p>
        <div className="space-y-2 font-ui text-sm">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-baseline gap-3 border-b border-mitti/10 pb-2">
              <span className={`badge-founder ${ROLE_COLOR[r.value]}`}>{r.label}</span>
              <span className="text-mitti">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}
    </>
  );
}

function CreateModal({ onClose, onCreated }: any) {
  const [form, setForm] = useState({ email: '', name: '', phone: '', role: 'ADMIN', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onCreated();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-kohl/60 z-50 flex items-center justify-center p-6">
      <form onSubmit={submit} className="bg-ivory max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-mitti/20">
          <h2 className="font-display text-2xl text-kohl">Add Team Member</h2>
          <button type="button" onClick={onClose}><X className="w-5 h-5 text-mitti" /></button>
        </div>
        <div className="p-6 space-y-4">
          {error && <p className="font-ui text-xs text-madder bg-madder/10 p-2">{error}</p>}
          <div>
            <label className="label text-mitti block mb-1">Full Name *</label>
            <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          </div>
          <div>
            <label className="label text-mitti block mb-1">Email *</label>
            <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          </div>
          <div>
            <label className="label text-mitti block mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
              placeholder="+91 ..." className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm" />
          </div>
          <div>
            <label className="label text-mitti block mb-1">Role *</label>
            <select required value={form.role} onChange={e => setForm({...form, role: e.target.value})}
              className="w-full p-3 bg-beige border border-mitti/20 font-ui text-sm">
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-mitti block mb-1">Temporary Password *</label>
            <input type="text" required minLength={8} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              placeholder="Min 8 characters" className="w-full p-3 bg-beige border border-mitti/20 font-mono text-sm" />
            <p className="font-ui text-[11px] text-mitti mt-1">Share securely. Encourage user to change after first login.</p>
          </div>
        </div>
        <div className="border-t border-mitti/20 p-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline">CANCEL</button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'CREATING...' : 'CREATE ACCOUNT'}
          </button>
        </div>
      </form>
    </div>
  );
}
