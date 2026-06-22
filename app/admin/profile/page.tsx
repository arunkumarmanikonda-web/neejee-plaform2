'use client';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { PhoneInput } from '@/components/ui/PhoneInput';

export default function AdminProfile() {
  const [me, setMe] = useState<any>(null);
  const [form, setForm] = useState<{ name: string; phone: string; password: string }>({ name: '', phone: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      setMe(d);
      setForm({ name: d.name || '', phone: d.phone || '', password: '' });
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(''); setError('');
    try {
      const payload: any = { name: form.name, phone: form.phone };
      if (form.password) payload.password = form.password;
      const res = await fetch('/api/admin/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setMsg('Profile saved. Sign out and back in to refresh your session display.');
      setForm({ ...form, password: '' });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-mitti">Loading...</p>;

  return (
    <>
      <p className="label text-madder">ACCOUNT</p>
      <h1 className="font-display text-4xl text-kohl mt-2">My Profile</h1>
      <p className="font-italic italic text-mitti mt-2">Update your display name, phone, or password.</p>
      <div className="madder-divider mt-4"></div>

      {msg && <p className="mt-6 font-ui text-sm text-neem bg-neem/10 p-3">{msg}</p>}
      {error && <p className="mt-6 font-ui text-sm text-madder bg-madder/10 p-3">{error}</p>}

      <form onSubmit={save} className="mt-8 max-w-xl space-y-4">
        <div className="bg-beige p-6 space-y-4">
          <div>
            <label className="label text-mitti block mb-1">Email (cannot change)</label>
            <input value={me?.email || ''} disabled className="w-full p-3 bg-ivory/50 border border-mitti/20 font-ui text-sm text-mitti" />
          </div>
          <div>
            <label className="label text-mitti block mb-1">Role</label>
            <input value={me?.role?.replace(/_/g, ' ') || ''} disabled className="w-full p-3 bg-ivory/50 border border-mitti/20 font-ui text-sm text-mitti" />
          </div>
          <div>
            <label className="label text-mitti block mb-1">Display Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Admin" className="w-full p-3 bg-ivory border border-mitti/20 font-ui text-sm" />
            <p className="font-ui text-[11px] text-mitti mt-1">Shown in the sidebar and admin emails.</p>
          </div>
          <div>
            <label className="label text-mitti block mb-1">Phone</label>
            <PhoneInput value={form.phone} onChange={(v) => setForm({...form, phone: v})} defaultCountry="IN" />
          </div>
          <div>
            <label className="label text-mitti block mb-1">New Password (optional)</label>
            <input type="text" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              placeholder="Leave blank to keep current" className="w-full p-3 bg-ivory border border-mitti/20 font-mono text-sm" />
            <p className="font-ui text-[11px] text-mitti mt-1">Min 8 characters. You'll need to sign in again after change.</p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-50">
          <Save className="w-4 h-4" /> {saving ? 'SAVING...' : 'SAVE PROFILE'}
        </button>
      </form>
    </>
  );
}
