'use client';
// app/admin/recovery-settings/page.tsx
// v26.3a — Recovery cadence + discount % + AI toggle.

import { useEffect, useState } from 'react';

export default function RecoverySettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/admin/recovery-settings').then(r => r.json()).then(d => setSettings(d.settings));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true); setMsg('');
    const res = await fetch('/api/admin/recovery-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cadenceHours: settings.cadenceHours,
        discountPercents: settings.discountPercents,
        aiEnabled: settings.aiEnabled,
        telecallerHandoffEnabled: settings.telecallerHandoffEnabled,
        abandonGraceMinutes: settings.abandonGraceMinutes,
      }),
    });
    const d = await res.json();
    setSettings(d.settings);
    setSaving(false);
    setMsg('Saved');
    setTimeout(() => setMsg(''), 2000);
  };

  if (!settings) return <main className="p-8"><p className="text-mitti italic">Loading…</p></main>;

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl text-kohl">Recovery settings</h1>
      <p className="font-italic italic text-mitti mt-1 mb-8">How and when the karigars reach out.</p>

      <section className="mb-8">
        <h2 className="font-display text-xl text-kohl mb-3">Cadence (hours after abandonment)</h2>
        <div className="space-y-3">
          {[
            ['stage1', 'First gentle nudge'],
            ['stage2', 'Karigars\' small gift (with discount)'],
            ['stage3', 'Before the loom rests (final)'],
            ['stage4', 'Telecaller handoff'],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center gap-3">
              <label className="text-sm text-kohl w-72">{label}</label>
              <input
                type="number"
                min={1}
                value={settings.cadenceHours[k]}
                onChange={e => setSettings({
                  ...settings,
                  cadenceHours: { ...settings.cadenceHours, [k]: parseInt(e.target.value) || 1 },
                })}
                className="w-24 border border-mitti/30 px-3 py-1.5 text-sm"
              />
              <span className="text-xs text-mitti">hours</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl text-kohl mb-3">Discount percentages</h2>
        <div className="space-y-3">
          {[
            ['stage2', 'T+24h offer'],
            ['stage3', 'T+72h farewell gift'],
          ].map(([k, label]) => (
            <div key={k} className="flex items-center gap-3">
              <label className="text-sm text-kohl w-72">{label}</label>
              <input
                type="number"
                min={0}
                max={50}
                value={settings.discountPercents[k]}
                onChange={e => setSettings({
                  ...settings,
                  discountPercents: { ...settings.discountPercents, [k]: parseInt(e.target.value) || 0 },
                })}
                className="w-24 border border-mitti/30 px-3 py-1.5 text-sm"
              />
              <span className="text-xs text-mitti">%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-display text-xl text-kohl mb-3">Behaviour</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.aiEnabled}
              onChange={e => setSettings({ ...settings, aiEnabled: e.target.checked })}
            />
            <span>Personalize email copy with AI (fallback to template if AI unavailable)</span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.telecallerHandoffEnabled}
              onChange={e => setSettings({ ...settings, telecallerHandoffEnabled: e.target.checked })}
            />
            <span>Notify telecaller team on T+7d handoff</span>
          </label>
          <div className="flex items-center gap-3">
            <label className="text-sm text-kohl w-72">Abandonment grace period</label>
            <input
              type="number"
              min={0}
              value={settings.abandonGraceMinutes}
              onChange={e => setSettings({ ...settings, abandonGraceMinutes: parseInt(e.target.value) || 0 })}
              className="w-24 border border-mitti/30 px-3 py-1.5 text-sm"
            />
            <span className="text-xs text-mitti">minutes</span>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving} className="bg-kohl text-ivory px-6 py-2 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {msg && <span className="text-sm text-green-700 italic">{msg}</span>}
      </div>
    </main>
  );
}
