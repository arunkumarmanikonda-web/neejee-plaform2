'use client';
import { useEffect, useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';

export default function AccountPage() {
  const [me, setMe] = useState<any>(null);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/seller/me');
      const j = await r.json();
      setMe(j);
    })();
  }, []);

  const submit = async () => {
    setErr(''); setMsg('');
    if (form.newPassword !== form.confirmPassword) {
      setErr('Passwords do not match'); return;
    }
    if (form.newPassword.length < 8) {
      setErr('Password must be at least 8 characters'); return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/seller/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword || null,
          newPassword: form.newPassword,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg('Password updated');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      setErr(e.message);
    } finally { setSaving(false); }
  };

  if (!me) return <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl text-kohl">Account</h1>
        <p className="text-mitti text-sm">Login & security</p>
      </div>

      <div className="bg-ivory border border-mitti/20 p-6 rounded">
        <p className="label text-banarasi">SIGNED IN AS</p>
        <p className="font-display text-lg text-kohl mt-1">{me.seller?.email}</p>
        <p className="text-mitti text-xs mt-1">Role: {me.ctx.isOwner ? 'Studio owner' : 'Staff (' + me.ctx.accessLevel + ')'}</p>
      </div>

      <div className="bg-ivory border border-mitti/20 p-6 rounded">
        <h3 className="font-display text-lg text-kohl flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-banarasi" />
          {me.seller?.hasPassword ? 'Change password' : 'Set a password'}
        </h3>
        <p className="text-mitti text-xs mt-1 mb-4">
          {me.seller?.hasPassword
            ? 'You can change your password any time.'
            : 'You currently sign in via magic link. Set a password for faster sign-in.'}
        </p>

        <div className="space-y-3">
          {me.seller?.hasPassword && (
            <Field label="CURRENT PASSWORD" type="password" value={form.currentPassword}
              onChange={v => setForm({ ...form, currentPassword: v })} />
          )}
          <Field label="NEW PASSWORD" type="password" value={form.newPassword}
            onChange={v => setForm({ ...form, newPassword: v })} />
          <Field label="CONFIRM NEW PASSWORD" type="password" value={form.confirmPassword}
            onChange={v => setForm({ ...form, confirmPassword: v })} />
        </div>

        {err && <div className="mt-3 bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}
        {msg && <div className="mt-3 bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}

        <button onClick={submit} disabled={saving}
          className="mt-4 bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
          {saving ? 'SAVING…' : me.seller?.hasPassword ? 'CHANGE PASSWORD' : 'SET PASSWORD'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
    </div>
  );
}
