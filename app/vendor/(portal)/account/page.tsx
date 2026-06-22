'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, KeyRound, Mail, Bell, Save } from 'lucide-react';

export default function VendorAccountPage() {
  const [me, setMe] = useState<any>(null);
  const [pref, setPref] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Password form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pwdSaving, setPwdSaving] = useState(false);

  // Notification toggles
  const [savingPref, setSavingPref] = useState(false);
  const [prefMsg, setPrefMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/vendor/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      fetch('/api/vendor/account/notifications', { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
    ]).then(([m, p]) => {
      setMe(m);
      setPref(p?.pref || { emailOptIn: true, whatsappOptIn: true, smsOptIn: false });
      setLoading(false);
    });
  }, []);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (newPwd.length < 8) { setPwdMsg({ kind: 'err', text: 'Password must be at least 8 characters' }); return; }
    if (newPwd !== confirmPwd) { setPwdMsg({ kind: 'err', text: 'Passwords do not match' }); return; }
    setPwdSaving(true);
    try {
      const r = await fetch('/api/vendor/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPwd || undefined,
          newPassword: newPwd,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Could not change password');
      setPwdMsg({ kind: 'ok', text: me?.vendor?.hasPassword ? 'Password changed.' : 'Password set.' });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setShowPasswordForm(false);
      // Refetch /me to refresh hasPassword flag
      const r2 = await fetch('/api/vendor/me', { cache: 'no-store' });
      if (r2.ok) setMe(await r2.json());
    } catch (e: any) {
      setPwdMsg({ kind: 'err', text: e.message });
    } finally { setPwdSaving(false); }
  };

  const savePrefs = async () => {
    setSavingPref(true); setPrefMsg(null);
    try {
      const r = await fetch('/api/vendor/account/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pref),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Save failed');
      setPref(d.pref);
      setPrefMsg({ kind: 'ok', text: 'Preferences saved.' });
    } catch (e: any) {
      setPrefMsg({ kind: 'err', text: e.message });
    } finally { setSavingPref(false); }
  };

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;
  if (!me?.vendor) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8 space-y-5">
      <header>
        <h1 className="font-display text-3xl text-kohl">Account</h1>
        <p className="text-sm text-mitti mt-1">Manage your sign-in and notification preferences.</p>
      </header>

      <section className="bg-ivory border border-mitti/15 p-5">
        <h2 className="font-display text-lg text-kohl uppercase tracking-wider mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-madder" /> Sign-in
        </h2>
        <p className="text-sm text-mitti mb-1">Email <span className="font-mono text-kohl">{me.vendor.contactEmail}</span></p>
        <p className="text-[11px] italic text-mitti/70">To change your email, contact <a href="mailto:partners@neejee.com" className="text-madder">partners@neejee.com</a> — we'll update it after verification.</p>
      </section>

      <section className="bg-ivory border border-mitti/15 p-5">
        <h2 className="font-display text-lg text-kohl uppercase tracking-wider mb-3 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-madder" /> Password
        </h2>
        {!showPasswordForm ? (
          <div>
            <p className="text-sm text-mitti">
              {me.vendor.hasPassword
                ? 'You have a password set. Use it to sign in directly without waiting for a magic link.'
                : 'You don\'t have a password yet. Set one so you can sign in directly without a magic link.'}
            </p>
            <button onClick={() => setShowPasswordForm(true)} className="btn-primary text-xs mt-3 inline-flex items-center gap-1">
              <KeyRound className="w-3 h-3" /> {me.vendor.hasPassword ? 'CHANGE PASSWORD' : 'SET A PASSWORD'}
            </button>
            {pwdMsg && (
              <div className={`mt-3 p-3 text-sm border ${pwdMsg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
                {pwdMsg.text}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={savePassword} className="space-y-3">
            {me.vendor.hasPassword && (
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-mitti">Current password</span>
                <input type="password" required value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
              </label>
            )}
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-mitti">New password (8+ characters)</span>
              <input type="password" required minLength={8} value={newPwd} onChange={e => setNewPwd(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-mitti">Confirm new password</span>
              <input type="password" required minLength={8} value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
            </label>
            {pwdMsg && (
              <div className={`p-2 text-xs border ${pwdMsg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
                {pwdMsg.text}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={pwdSaving} className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
                {pwdSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                SAVE
              </button>
              <button type="button" onClick={() => { setShowPasswordForm(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); setPwdMsg(null); }} className="btn-ghost text-xs">
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="bg-ivory border border-mitti/15 p-5">
        <h2 className="font-display text-lg text-kohl uppercase tracking-wider mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-madder" /> Notification preferences
        </h2>
        <p className="text-sm text-mitti mb-3">
          Choose how we send you updates about purchase orders, payments, and account changes.
          {' '}Critical security alerts (login, bank changes) are always sent over email regardless of these settings.
        </p>
        <ul className="space-y-3">
          <ToggleRow label="Email" description="To your sign-in address" checked={pref.emailOptIn} onChange={v => setPref({ ...pref, emailOptIn: v })} />
          <ToggleRow label="WhatsApp" description="To your registered contact number" checked={pref.whatsappOptIn} onChange={v => setPref({ ...pref, whatsappOptIn: v })} />
          <ToggleRow label="SMS" description="Standard SMS to your contact number" checked={pref.smsOptIn} onChange={v => setPref({ ...pref, smsOptIn: v })} />
        </ul>
        {prefMsg && (
          <div className={`mt-3 p-2 text-xs border ${prefMsg.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-madder/5 border-madder/30 text-madder'}`}>
            {prefMsg.text}
          </div>
        )}
        <button onClick={savePrefs} disabled={savingPref} className="btn-primary text-xs mt-4 inline-flex items-center gap-1 disabled:opacity-50">
          {savingPref ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} SAVE PREFERENCES
        </button>
      </section>

      <section className="bg-ivory border border-mitti/15 p-5">
        <h2 className="font-display text-lg text-kohl uppercase tracking-wider mb-3">Other</h2>
        <Link href="/vendor/activity" className="text-sm text-madder hover:underline">View account activity log →</Link>
      </section>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-display text-kohl">{label}</p>
        <p className="text-[11px] text-mitti">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center transition-colors ${checked ? 'bg-madder' : 'bg-mitti/30'}`}
        aria-pressed={checked}
      >
        <span className={`inline-block h-4 w-4 transform bg-ivory transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </li>
  );
}
