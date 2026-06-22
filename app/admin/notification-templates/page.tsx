'use client';
// app/admin/notification-templates/page.tsx
// v26.3b — Admin view: paste in DLT Template IDs once they're approved,
// mark templates as Approved/Pending, toggle enabled.

import { useEffect, useState } from 'react';

interface Tpl {
  id: string;
  key: string;
  channel: 'sms' | 'whatsapp';
  providerName: string;
  providerTemplateId: string | null;
  displayName: string;
  variableCount: number;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  enabled: boolean;
  lastUsedAt: string | null;
}

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, Partial<Tpl>>>({});

  const load = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/notification-templates');
    const d = await res.json();
    setTemplates(d.templates || []);
    setEdits({});
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setEdit = (id: string, patch: Partial<Tpl>) => {
    setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  };

  const save = async (id: string) => {
    const patch = edits[id];
    if (!patch) return;
    await fetch('/api/admin/notification-templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    });
    await load();
  };

  const grouped = {
    sms: templates.filter(t => t.channel === 'sms'),
    whatsapp: templates.filter(t => t.channel === 'whatsapp'),
  };

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="font-display text-3xl text-kohl">Notification templates</h1>
      <p className="text-mitti italic mt-1 mb-6 text-sm">
        Once Fast2SMS or AiSensy approves a template, paste the provider's template ID/name here and
        mark it Approved. The platform will pick it up on the next message.
      </p>

      {loading ? (
        <p className="text-mitti italic">Loading…</p>
      ) : (
        <>
          {(['sms','whatsapp'] as const).map(channel => (
            <section key={channel} className="mb-10">
              <h2 className="font-display text-xl text-kohl mb-3 uppercase tracking-widest text-sm">
                {channel === 'sms' ? 'SMS (Fast2SMS)' : 'WhatsApp (AiSensy)'}
              </h2>
              <div className="border border-mitti/30 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mitti/30 bg-beige text-left text-xs uppercase tracking-widest text-mitti">
                      <th className="p-3">Key</th>
                      <th className="p-3">Display name</th>
                      <th className="p-3">Vars</th>
                      <th className="p-3">Provider ID</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Enabled</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[channel].map(t => {
                      const e = edits[t.id] || {};
                      const idVal = e.providerTemplateId ?? t.providerTemplateId ?? '';
                      const statusVal = e.approvalStatus ?? t.approvalStatus;
                      const enabledVal = e.enabled ?? t.enabled;
                      const dirty = Object.keys(e).length > 0;
                      return (
                        <tr key={t.id} className="border-b border-mitti/10">
                          <td className="p-3 font-mono text-xs">{t.key}</td>
                          <td className="p-3">{t.displayName}</td>
                          <td className="p-3 text-center">{t.variableCount}</td>
                          <td className="p-3">
                            <input
                              type="text"
                              placeholder={channel === 'sms' ? '19-digit DLT ID' : 'template_name'}
                              value={idVal}
                              onChange={ev => setEdit(t.id, { providerTemplateId: ev.target.value })}
                              className="w-48 border border-mitti/30 px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={statusVal}
                              onChange={ev => setEdit(t.id, { approvalStatus: ev.target.value as any })}
                              className="border border-mitti/30 px-2 py-1 text-xs"
                            >
                              <option value="pending">pending</option>
                              <option value="approved">approved</option>
                              <option value="rejected">rejected</option>
                            </select>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={enabledVal}
                              onChange={ev => setEdit(t.id, { enabled: ev.target.checked })}
                            />
                          </td>
                          <td className="p-3">
                            {dirty && (
                              <button
                                onClick={() => save(t.id)}
                                className="bg-kohl text-ivory px-3 py-1 text-xs"
                              >Save</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
