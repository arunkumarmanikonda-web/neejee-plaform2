'use client';
import { useEffect, useState } from 'react';
import { MessageSquare, Send, Save, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

interface Template {
  id: string;
  event: string;
  label: string;
  templateId: string;
  body: string;
  varOrder: string[];
  category: string;
  active: boolean;
  notes: string | null;
  lastUsedAt: string | null;
}

interface Health {
  configured: boolean;
  senderId: string;
  entityId: string;
  mode: string;
  balance: { ok: boolean; balance?: number; error?: string };
}

interface LogRow {
  id: string;
  event: string;
  recipient: string;
  status: string;
  error: string | null;
  createdAt: string;
}

export default function SmsAdminPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEvent, setSavingEvent] = useState<string | null>(null);

  // Send test state
  const [testPhone, setTestPhone] = useState('');
  const [testEvent, setTestEvent] = useState('otp_login');
  const [testVars, setTestVars] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function loadAll() {
    setLoading(true);
    const [t, h, l] = await Promise.all([
      fetch('/api/admin/sms/templates').then(r => r.json()),
      fetch('/api/admin/sms/test').then(r => r.json()),
      fetch('/api/admin/sms/logs').then(r => r.json()),
    ]);
    setTemplates(t.templates || []);
    setHealth(h);
    setLogs(l.logs || []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function saveTemplate(t: Template) {
    setSavingEvent(t.event);
    const res = await fetch('/api/admin/sms/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: t.event,
        templateId: t.templateId,
        body: t.body,
        varOrder: t.varOrder,
        active: t.active,
        notes: t.notes,
      }),
    });
    if (res.ok) await loadAll();
    setSavingEvent(null);
  }

  async function sendTest() {
    if (!testPhone || !testEvent) return;
    setSending(true);
    setTestResult(null);
    const res = await fetch('/api/admin/sms/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, event: testEvent, vars: testVars }),
    });
    const data = await res.json();
    setTestResult(data.ok ? `✓ Sent (requestId: ${data.requestId || 'n/a'})` : `✗ ${data.error || 'Failed'}`);
    setSending(false);
    await loadAll();
  }

  const selectedTpl = templates.find(t => t.event === testEvent);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-madder" /> SMS &amp; OTP
          </h1>
          <p className="font-ui text-sm text-kohl/60 mt-1">Fast2SMS DLT template registry, OTP, and delivery logs</p>
        </div>
        <button onClick={loadAll} className="font-ui text-sm flex items-center gap-1 px-3 py-2 border border-kohl/20 hover:bg-beige">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Health card */}
      {health && (
        <div className="bg-beige p-5 mb-6 grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="Configured" value={health.configured ? '✓ Yes' : '✗ No'} good={health.configured} />
          <Stat label="Sender ID" value={health.senderId} />
          <Stat label="Entity ID" value={health.entityId === 'set' ? '✓ Set' : '✗ Missing'} good={health.entityId === 'set'} />
          <Stat label="Mode" value={health.mode} />
          <Stat label="Balance" value={health.balance.ok ? `₹${health.balance.balance}` : (health.balance.error || '—')} good={health.balance.ok} />
        </div>
      )}

      {/* Send test */}
      <div className="bg-white border border-kohl/10 p-5 mb-6">
        <h2 className="font-display text-xl text-kohl mb-3 flex items-center gap-2">
          <Send className="w-5 h-5 text-madder" /> Send test SMS
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block font-ui text-xs text-kohl/60 mb-1">Phone (+91…)</label>
            <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="+919876543210" className="w-full border border-kohl/20 px-3 py-2 font-ui text-sm" />
          </div>
          <div>
            <label className="block font-ui text-xs text-kohl/60 mb-1">Event / Template</label>
            <select value={testEvent} onChange={e => { setTestEvent(e.target.value); setTestVars({}); }} className="w-full border border-kohl/20 px-3 py-2 font-ui text-sm">
              {templates.map(t => (
                <option key={t.event} value={t.event}>{t.label} ({t.event})</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={sendTest} disabled={sending || !testPhone} className="px-5 py-2 bg-madder text-white font-ui text-sm hover:bg-madder/90 disabled:opacity-50 w-full">
              {sending ? 'Sending…' : 'Send test'}
            </button>
          </div>
        </div>
        {selectedTpl && selectedTpl.varOrder.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {selectedTpl.varOrder.map(k => (
              <div key={k}>
                <label className="block font-ui text-xs text-kohl/60 mb-1">{k}</label>
                <input value={testVars[k] || ''} onChange={e => setTestVars(v => ({ ...v, [k]: e.target.value }))} placeholder={`<${k}>`} className="w-full border border-kohl/20 px-2 py-1 font-ui text-sm" />
              </div>
            ))}
          </div>
        )}
        {selectedTpl && (
          <div className="mt-2 p-3 bg-beige font-ui text-sm text-kohl/80">
            <span className="text-xs text-kohl/60">Preview: </span>{selectedTpl.body}
          </div>
        )}
        {testResult && (
          <div className={`mt-3 p-3 font-ui text-sm ${testResult.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {testResult}
          </div>
        )}
      </div>

      {/* Templates */}
      <div className="bg-white border border-kohl/10 p-5 mb-6">
        <h2 className="font-display text-xl text-kohl mb-3">DLT Template Registry</h2>
        <p className="font-ui text-sm text-kohl/60 mb-4">
          Paste the 19-digit template ID from your operator portal (Jio, Vi, Airtel, BSNL) against each event.
          A template is <em>ready</em> only when the ID is real (not <code>PASTE_DLT_ID</code>) and active.
        </p>
        {loading ? <div className="text-kohl/50">Loading…</div> : (
          <div className="space-y-3">
            {templates.map(t => (
              <TemplateRow key={t.event} t={t} saving={savingEvent === t.event} onSave={saveTemplate} />
            ))}
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="bg-white border border-kohl/10 p-5">
        <h2 className="font-display text-xl text-kohl mb-3">Last 50 SMS sent</h2>
        {logs.length === 0 ? (
          <div className="text-kohl/50 font-ui text-sm">No SMS yet.</div>
        ) : (
          <table className="w-full font-ui text-sm">
            <thead className="text-left text-kohl/60 text-xs">
              <tr><th className="p-2">When</th><th className="p-2">Event</th><th className="p-2">Recipient</th><th className="p-2">Status</th><th className="p-2">Error</th></tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-t border-kohl/10">
                  <td className="p-2 text-kohl/70">{new Date(l.createdAt).toLocaleString('en-IN')}</td>
                  <td className="p-2">{l.event}</td>
                  <td className="p-2 font-mono text-xs">{l.recipient}</td>
                  <td className={`p-2 ${l.status === 'SENT' ? 'text-green-700' : l.status === 'FAILED' ? 'text-red-700' : 'text-kohl/60'}`}>{l.status}</td>
                  <td className="p-2 text-red-700 text-xs">{l.error || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <div className="font-ui text-xs text-kohl/60 uppercase tracking-wider">{label}</div>
      <div className={`font-ui text-sm mt-1 ${good === true ? 'text-green-700' : good === false ? 'text-red-700' : 'text-kohl'}`}>{value}</div>
    </div>
  );
}

function TemplateRow({ t, saving, onSave }: { t: Template; saving: boolean; onSave: (t: Template) => void }) {
  const [local, setLocal] = useState<Template>(t);
  useEffect(() => setLocal(t), [t]);
  const ready = local.active && local.templateId !== 'PASTE_DLT_ID' && /^\d{6,25}$/.test(local.templateId);
  return (
    <div className="border border-kohl/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {ready ? <CheckCircle2 className="w-4 h-4 text-green-700" /> : <AlertCircle className="w-4 h-4 text-amber-600" />}
          <span className="font-ui font-medium">{local.label}</span>
          <span className="font-ui text-xs text-kohl/50">({local.event})</span>
          <span className="font-ui text-xs px-2 py-0.5 bg-beige">{local.category}</span>
        </div>
        <label className="flex items-center gap-2 font-ui text-xs">
          <input type="checkbox" checked={local.active} onChange={e => setLocal({ ...local, active: e.target.checked })} />
          Active
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block font-ui text-xs text-kohl/60 mb-1">DLT Template ID</label>
          <input value={local.templateId} onChange={e => setLocal({ ...local, templateId: e.target.value })} placeholder="1707171234567890123" className="w-full border border-kohl/20 px-2 py-1.5 font-mono text-xs" />
        </div>
        <div className="md:col-span-2">
          <label className="block font-ui text-xs text-kohl/60 mb-1">Body (must match DLT-approved text exactly)</label>
          <textarea value={local.body} onChange={e => setLocal({ ...local, body: e.target.value })} rows={2} className="w-full border border-kohl/20 px-2 py-1.5 font-ui text-xs" />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="font-ui text-xs text-kohl/50">
          Vars: {local.varOrder.length === 0 ? '(none)' : local.varOrder.join(' → ')} {local.lastUsedAt && `· Last used ${new Date(local.lastUsedAt).toLocaleString('en-IN')}`}
        </div>
        <button onClick={() => onSave(local)} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-kohl text-cream font-ui text-xs hover:bg-kohl/90 disabled:opacity-50">
          <Save className="w-3 h-3" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
