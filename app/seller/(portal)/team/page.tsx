'use client';
import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Trash2 } from 'lucide-react';

const ACCESS = {
  FULL: 'Full access',
  INVENTORY_ONLY: 'Inventory only',
  FINANCE_ONLY: 'Finance only',
};

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', displayName: '', accessLevel: 'INVENTORY_ONLY' });
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/seller/team');
    const j = await r.json();
    setMembers(j.members || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const invite = async () => {
    setErr(''); setInviting(true);
    try {
      const r = await fetch('/api/seller/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(`Invitation sent to ${inviteForm.email}`);
      setInviteForm({ email: '', displayName: '', accessLevel: 'INVENTORY_ONLY' });
      setShowInvite(false);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally { setInviting(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this team member?')) return;
    await fetch(`/api/seller/team/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-kohl">Team Members</h1>
          <p className="text-mitti text-sm">Invite an accountant, dispatch person, or co-founder</p>
        </div>
        <button onClick={() => setShowInvite(!showInvite)}
          className="bg-kohl text-ivory px-4 py-2 font-ui text-xs tracking-widest flex items-center gap-2">
          <UserPlus className="w-3 h-3" /> {showInvite ? 'CLOSE' : 'INVITE MEMBER'}
        </button>
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}
      {err && <div className="bg-madder/10 border border-madder p-3 text-madder text-sm">{err}</div>}

      {showInvite && (
        <div className="bg-ivory border border-mitti/30 p-6 rounded space-y-3">
          <h3 className="font-display text-lg text-kohl">New invitation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="EMAIL" value={inviteForm.email} onChange={v => setInviteForm({ ...inviteForm, email: v })} />
            <Field label="DISPLAY NAME" value={inviteForm.displayName} onChange={v => setInviteForm({ ...inviteForm, displayName: v })} />
          </div>
          <div>
            <p className="label text-banarasi mb-1">ACCESS LEVEL</p>
            <select value={inviteForm.accessLevel} onChange={e => setInviteForm({ ...inviteForm, accessLevel: e.target.value })}
              className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory">
              <option value="FULL">Full access — everything except team management</option>
              <option value="INVENTORY_ONLY">Inventory only — products & orders, no bank/payouts</option>
              <option value="FINANCE_ONLY">Finance only — payouts & bank, no inventory edits</option>
            </select>
          </div>
          <button onClick={invite} disabled={inviting || !inviteForm.email}
            className="bg-kohl text-ivory px-5 py-2 font-ui text-xs tracking-widest disabled:opacity-50">
            {inviting ? 'SENDING…' : 'SEND INVITATION'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : members.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          Just you for now. Invite an accountant or dispatch person to share the load.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">EMAIL</th>
                <th className="text-left p-3">NAME</th>
                <th className="text-left p-3">ACCESS</th>
                <th className="text-center p-3">STATUS</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-t border-mitti/10">
                  <td className="p-3 text-kohl">{m.email}</td>
                  <td className="p-3 text-mitti">{m.displayName || '—'}</td>
                  <td className="p-3 text-mitti">{(ACCESS as any)[m.accessLevel]}</td>
                  <td className="p-3 text-center">
                    <span className={`text-[10px] tracking-widest px-2 py-0.5 rounded ${
                      m.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-banarasi/20 text-banarasi'
                    }`}>{m.status}</span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => remove(m.id)} className="text-madder hover:opacity-70">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="label text-banarasi mb-1">{label}</p>
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-mitti/30 px-3 py-2 font-ui text-sm bg-ivory" />
    </div>
  );
}
