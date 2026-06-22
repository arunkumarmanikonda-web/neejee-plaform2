'use client';
import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Trash2, Users } from 'lucide-react';

const ACCESS_LEVELS = [
  { key: 'FULL',            label: 'Full access',         desc: 'Can do everything except sensitive bank/legal edits (still admin-approved).' },
  { key: 'FINANCE_ONLY',    label: 'Finance only',        desc: 'Payouts, TDS, invoices. Cannot confirm POs.' },
  { key: 'OPERATIONS_ONLY', label: 'Operations only',     desc: 'PO confirm, dispatch, GRN, documents. No banking.' },
];

export default function VendorTeamPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', displayName: '', accessLevel: 'FULL' });
  const [inviteSaving, setInviteSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/vendor/team', { cache: 'no-store' });
    const d = await r.json();
    setMembers(d.members || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault(); setInviteSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/vendor/team', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Invite failed');
      setMsg({ kind: 'ok', text: `Invitation sent to ${inviteForm.email}.` });
      setShowInvite(false);
      setInviteForm({ email: '', displayName: '', accessLevel: 'FULL' });
      await load();
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally { setInviteSaving(false); }
  };

  const updateMember = async (id: string, data: any) => {
    const r = await fetch(`/api/vendor/team/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (r.ok) await load();
  };

  const removeMember = async (id: string, email: string) => {
    if (!confirm(`Remove ${email} from your team?`)) return;
    const r = await fetch(`/api/vendor/team/${id}`, { method: 'DELETE' });
    if (r.ok) await load();
  };

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
            <Users className="w-6 h-6 text-madder" /> Team Members
          </h1>
          <p className="text-sm text-mitti mt-1">Invite your accountant, dispatch person, or partner to access the portal with limited permissions.</p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary text-xs inline-flex items-center gap-1">
          <UserPlus className="w-3 h-3" /> INVITE
        </button>
      </header>

      {msg && (
        <div className={`p-3 text-sm border ${msg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
          {msg.text}
        </div>
      )}

      <section className="bg-ivory border border-mitti/15">
        {loading ? (
          <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 mx-auto text-mitti/40 mb-3" />
            <p className="font-display text-lg text-kohl">No team members yet</p>
            <p className="text-xs text-mitti mt-2">Click INVITE above to add your first team member.</p>
          </div>
        ) : (
          <ul>
            {members.map(m => (
              <li key={m.id} className="border-t border-mitti/10 first:border-t-0 px-5 py-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display text-kohl">{m.displayName || m.email}</p>
                  <p className="text-[11px] text-mitti">{m.email}</p>
                  <p className="text-[11px] text-mitti">
                    Status: <strong>{m.status}</strong> · Access: <strong>{m.accessLevel.replace('_', ' ')}</strong>
                    {m.invitedAt && ` · Invited ${new Date(m.invitedAt).toLocaleDateString()}`}
                  </p>
                </div>
                <select
                  value={m.accessLevel}
                  onChange={e => updateMember(m.id, { accessLevel: e.target.value })}
                  className="p-1 bg-beige border border-mitti/20 text-xs font-ui"
                  disabled={m.status === 'REMOVED'}
                >
                  {ACCESS_LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
                {m.status === 'ACTIVE' && (
                  <button onClick={() => updateMember(m.id, { status: 'SUSPENDED' })} className="text-xs text-mitti hover:text-madder">Suspend</button>
                )}
                {m.status === 'SUSPENDED' && (
                  <button onClick={() => updateMember(m.id, { status: 'ACTIVE' })} className="text-xs text-mitti hover:text-madder">Reactivate</button>
                )}
                {m.status !== 'REMOVED' && (
                  <button onClick={() => removeMember(m.id, m.email)} className="text-mitti hover:text-madder" title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {showInvite && (
        <div className="fixed inset-0 bg-kohl/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={invite} className="bg-ivory max-w-md w-full p-6 space-y-3">
            <h2 className="font-display text-2xl text-kohl">Invite a team member</h2>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-mitti">Email *</span>
              <input type="email" required value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-mitti">Display name (optional)</span>
              <input type="text" value={inviteForm.displayName} onChange={e => setInviteForm({ ...inviteForm, displayName: e.target.value })} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
            </label>
            <fieldset className="space-y-2">
              <legend className="text-[10px] uppercase tracking-widest text-mitti mb-1">Access level</legend>
              {ACCESS_LEVELS.map(l => (
                <label key={l.key} className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="accessLevel"
                    value={l.key}
                    checked={inviteForm.accessLevel === l.key}
                    onChange={e => setInviteForm({ ...inviteForm, accessLevel: e.target.value })}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-display text-kohl">{l.label}</p>
                    <p className="text-[11px] text-mitti">{l.desc}</p>
                  </div>
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowInvite(false)} className="btn-ghost text-xs">Cancel</button>
              <button type="submit" disabled={inviteSaving || !inviteForm.email} className="btn-primary text-xs disabled:opacity-50 inline-flex items-center gap-1">
                {inviteSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} SEND INVITE
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
