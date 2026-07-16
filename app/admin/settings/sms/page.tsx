'use client';

import { useEffect, useMemo, useState } from 'react';

type Template = {
  event: string;
  templateId: string;
  body: string;
  varOrder: string[];
  active: boolean;
  label?: string | null;
  category?: string | null;
  notes?: string | null;
  lastUsedAt?: string | null;
};

type ProviderTemplate = {
  id?: string;
  messageId: string;
  entityId?: string | null;
  entityName?: string | null;
  senderId?: string | null;
  status?: string | null;
  category?: string | null;
  language?: string | null;
  body: string;
  sourcePage?: string | null;
  rawMeta?: Record<string, unknown> | null;
};

type Health = {
  ok: boolean;
  configured: boolean;
  disabled: boolean;
  phase?: string;
  provider?: string;
  senderId?: string;
  entityId?: string;
  mode?: string;
  balance?: string | number | null;
  message?: string;
};

type LogRow = {
  id?: string;
  event?: string;
  recipient?: string;
  phone?: string;
  to?: string;
  status?: string;
  error?: string | null;
  createdAt?: string;
};

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `${url} failed (${res.status})`);
  }
  return data;
}

function providerLabel(row: ProviderTemplate) {
  const parts = [
    row.messageId,
    row.senderId || '',
    row.category || '',
    row.status || '',
  ].filter(Boolean);
  return parts.join(' • ');
}

export default function SmsAdminPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [providerTemplates, setProviderTemplates] = useState<ProviderTemplate[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [savingEvent, setSavingEvent] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testEvent, setTestEvent] = useState('');
  const [testVars, setTestVars] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [providerHtml, setProviderHtml] = useState('');
  const [syncingProvider, setSyncingProvider] = useState(false);

  const selectableTemplates = useMemo(
    () => templates.filter((row) => !!row.active && !!String(row.templateId || '').trim()),
    [templates]
  );

  const selectedTemplate =
    templates.find((row) => row.event === testEvent) || null;

  const approvedProviderTemplates = useMemo(() => {
    const approved = providerTemplates.filter((row) =>
      String(row.status || '').toLowerCase().includes('approved')
    );
    return approved.length ? approved : providerTemplates;
  }, [providerTemplates]);

  const selectedTemplateVarKeys =
    Array.isArray(selectedTemplate?.varOrder) && selectedTemplate!.varOrder.length
      ? selectedTemplate!.varOrder
      : ['code'];

  async function loadAll() {
    setLoading(true);
    setPageError('');
    setTestResult(null);

    const [t, h, l, p] = await Promise.allSettled([
      fetchJson('/api/admin/sms/templates'),
      fetchJson('/api/admin/sms/test'),
      fetchJson('/api/admin/sms/logs'),
      fetchJson('/api/admin/sms/provider-templates'),
    ]);

    const issues: string[] = [];

    if (t.status === 'fulfilled') {
      setTemplates(Array.isArray(t.value?.templates) ? t.value.templates : []);
    } else {
      setTemplates([]);
      issues.push(`templates: ${t.reason?.message || 'failed'}`);
    }

    if (h.status === 'fulfilled') {
      setHealth(h.value as Health);
    } else {
      setHealth({
        ok: false,
        configured: false,
        disabled: true,
        provider: 'Fast2SMS',
        mode: 'phase0',
        message: h.reason?.message || 'SMS provider health could not be loaded.',
      });
      issues.push(`health: ${h.reason?.message || 'failed'}`);
    }

    if (l.status === 'fulfilled') {
      setLogs(Array.isArray(l.value?.logs) ? l.value.logs : []);
    } else {
      setLogs([]);
      issues.push(`logs: ${l.reason?.message || 'failed'}`);
    }

    if (p.status === 'fulfilled') {
      setProviderTemplates(Array.isArray(p.value?.templates) ? p.value.templates : []);
    } else {
      setProviderTemplates([]);
      issues.push(`provider templates: ${p.reason?.message || 'failed'}`);
    }

    setPageError(
      issues.length
        ? `Some SMS admin data could not be loaded: ${issues.join(', ')}.`
        : ''
    );

    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!templates.length) return;

    if (selectableTemplates.length) {
      if (!selectableTemplates.some((row) => row.event === testEvent)) {
        setTestEvent(selectableTemplates[0].event);
        setTestVars({});
      }
      return;
    }

    if (!testEvent && templates[0]) {
      setTestEvent(templates[0].event);
      setTestVars({});
    }
  }, [templates, selectableTemplates, testEvent]);

  function updateTemplate(event: string, patch: Partial<Template>) {
    setTemplates((prev) => prev.map((row) => (row.event === event ? { ...row, ...patch } : row)));
  }

  function applyProviderTemplate(event: string, messageId: string) {
    const provider = providerTemplates.find((row) => row.messageId === messageId);
    if (!provider) return;

    setTemplates((prev) =>
      prev.map((row) => {
        if (row.event !== event) return row;

        const nextNotes = [
          'Mapped from Fast2SMS',
          provider.senderId ? `sender:${provider.senderId}` : '',
          provider.entityId ? `entity:${provider.entityId}` : '',
          provider.status ? `status:${provider.status}` : '',
          provider.language ? `language:${provider.language}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        return {
          ...row,
          templateId: provider.messageId,
          body: provider.body || row.body,
          category: provider.category || row.category,
          notes: nextNotes,
        };
      })
    );
  }

  async function saveTemplate(row: Template) {
    setSavingEvent(row.event);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/sms/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: row.event,
          templateId: row.templateId,
          body: row.body,
          varOrder: row.varOrder,
          active: row.active,
          label: row.label,
          category: row.category,
          notes: row.notes,
        }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`);
      setTestResult(`Template ${row.event} saved.`);
      await loadAll();
    } catch (e: any) {
      setTestResult(e?.message || 'Template save failed.');
    } finally {
      setSavingEvent(null);
    }
  }

  async function syncProviderTemplates() {
    setSyncingProvider(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/admin/sms/provider-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: providerHtml }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.error || `Sync failed (${res.status})`);

      setTestResult(`Imported ${data?.importedCount || 0} Fast2SMS provider templates.`);
      await loadAll();
    } catch (e: any) {
      setTestResult(e?.message || 'Provider template sync failed.');
    } finally {
      setSyncingProvider(false);
    }
  }

  async function sendTest() {
    setSending(true);
    setTestResult(null);

    if (!health || health.disabled || !health.configured) {
      setSending(false);
      setTestResult(health?.message || 'SMS provider is disabled or not configured.');
      return;
    }

    if (!selectedTemplate) {
      setSending(false);
      setTestResult('Choose an approved template first.');
      return;
    }

    if (!String(selectedTemplate.templateId || '').trim()) {
      setSending(false);
      setTestResult('Selected template is missing a DLT message ID.');
      return;
    }

    try {
      const res = await fetch('/api/admin/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, event: testEvent, vars: testVars }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data?.error || data?.message || `Test failed (${res.status})`);
      setTestResult('SMS test request accepted.');
    } catch (e: any) {
      setTestResult(e?.message || 'SMS test failed.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">SMS & OTP</h1>
          <p className="font-ui text-sm text-kohl/60 mt-1">
            Template registry, provider health, Fast2SMS sync, and delivery logs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          className="font-ui text-sm px-3 py-2 border border-kohl/20 hover:bg-beige"
        >
          Refresh
        </button>
      </div>

      {pageError ? (
        <div className="mb-6 border border-madder/30 bg-red-50 text-red-800 px-4 py-3 font-ui text-sm">
          {pageError}
        </div>
      ) : null}

      {health ? (
        <div className={`p-5 mb-6 grid grid-cols-2 md:grid-cols-5 gap-4 ${health.configured ? 'bg-beige' : 'bg-amber-50 border border-amber-200'}`}>
          <Stat label="Configured" value={health.configured ? 'Yes' : 'No'} />
          <Stat label="Provider" value={health.provider || 'Fast2SMS'} />
          <Stat label="Sender ID" value={health.senderId || ''} />
          <Stat label="Entity ID" value={health.entityId || ''} />
          <Stat label="Mode" value={health.mode || 'phase0'} />
        </div>
      ) : null}

      {!health?.configured ? (
        <div className="mb-6 border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 font-ui text-sm">
          {health?.message || 'SMS provider is not configured yet.'}
        </div>
      ) : null}

      <div className="bg-white border border-kohl/10 p-5 mb-6">
        <h2 className="font-display text-xl text-kohl mb-3">Sync from Fast2SMS</h2>
        <p className="font-ui text-sm text-kohl/70 mb-3">
          Paste the HTML page source from Fast2SMS DLT report3 and import approved provider templates into the local catalog.
        </p>

        <textarea
          value={providerHtml}
          onChange={(e) => setProviderHtml(e.target.value)}
          rows={8}
          placeholder="Paste Fast2SMS report3 page source HTML here"
          className="w-full border border-kohl/15 px-3 py-2 font-ui text-sm"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void syncProviderTemplates()}
            disabled={syncingProvider || !providerHtml.trim()}
            className="px-4 py-2 bg-kohl text-white font-ui text-sm disabled:opacity-50"
          >
            {syncingProvider ? 'Syncing' : 'Sync from Fast2SMS'}
          </button>

          <span className="font-ui text-sm text-mitti">
            Imported provider templates: {providerTemplates.length}
          </span>
        </div>

        {providerTemplates.length ? (
          <div className="mt-4 border border-kohl/10 bg-beige px-4 py-3">
            <p className="font-ui text-sm text-kohl">
              <span className="font-semibold">Catalog ready:</span> {providerTemplates.length} provider templates available for mapping.
            </p>
            <p className="font-ui text-xs text-mitti mt-1">
              Approved-visible options: {approvedProviderTemplates.length}
            </p>
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-kohl/10 p-5 mb-6">
        <h2 className="font-display text-xl text-kohl mb-3">Send test SMS</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="Phone"
            className="border border-kohl/15 px-3 py-2 font-ui text-sm"
          />

          <select
            value={testEvent}
            onChange={(e) => {
              setTestEvent(e.target.value);
              setTestVars({});
              setTestResult(null);
            }}
            className="border border-kohl/15 px-3 py-2 font-ui text-sm bg-white"
          >
            {!selectableTemplates.length ? (
              <option value="">No active templates with DLT ID</option>
            ) : null}
            {selectableTemplates.map((row) => (
              <option key={row.event} value={row.event}>
                {(row.label || row.event)} — {row.event} — {row.templateId}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {selectedTemplateVarKeys.map((key) => (
            <input
              key={key}
              value={testVars[key] || ''}
              onChange={(e) =>
                setTestVars((prev) => ({ ...prev, [key]: e.target.value }))
              }
              placeholder={`Sample var: ${key}`}
              disabled={!selectedTemplate}
              className="border border-kohl/15 px-3 py-2 font-ui text-sm disabled:opacity-50"
            />
          ))}
        </div>

        {selectedTemplate ? (
          <div className="mt-4 border border-kohl/10 bg-beige px-4 py-3">
            <p className="font-ui text-sm text-kohl">
              <span className="font-semibold">Selected template:</span>{' '}
              {selectedTemplate.label || selectedTemplate.event}
            </p>
            <p className="font-ui text-xs text-mitti mt-1">
              Event: {selectedTemplate.event}
              {' • '}
              Message ID: {selectedTemplate.templateId || 'Missing'}
              {' • '}
              Category: {selectedTemplate.category || ''}
              {' • '}
              Vars: {Array.isArray(selectedTemplate.varOrder) ? (selectedTemplate.varOrder.join(', ') || '') : ''}
            </p>
            <p className="font-ui text-xs text-kohl/80 mt-2 whitespace-pre-wrap">
              {selectedTemplate.body || 'No template body saved.'}
            </p>
          </div>
        ) : (
          <div className="mt-4 border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 font-ui text-sm">
            No approved template is ready for manual push. Mark a template Active and save a DLT message ID first.
          </div>
        )}

        <button
          type="button"
          onClick={() => void sendTest()}
          disabled={
            sending ||
            !health?.configured ||
            !!health?.disabled ||
            !selectedTemplate ||
            !String(selectedTemplate.templateId || '').trim()
          }
          className="mt-4 px-4 py-2 bg-kohl text-white font-ui text-sm disabled:opacity-50"
        >
          {sending ? 'Sending' : 'Send test'}
        </button>

        {testResult ? (
          <div className={`mt-3 px-3 py-2 font-ui text-sm ${/saved|accepted|imported/i.test(testResult) ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {testResult}
          </div>
        ) : null}
      </div>

      <div className="bg-white border border-kohl/10 p-5 mb-6">
        <h2 className="font-display text-xl text-kohl mb-3">DLT Template Registry</h2>
        {loading ? (
          <p className="font-ui text-sm text-mitti">Loading templates</p>
        ) : templates.length === 0 ? (
          <p className="font-ui text-sm text-mitti">No templates found.</p>
        ) : (
          <div className="space-y-4">
            {templates.map((row) => {
              const mappedProviderExists = providerTemplates.some(
                (provider) => provider.messageId === row.templateId
              );

              return (
                <div key={row.event} className="border border-kohl/10 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-display text-kohl">{row.label || row.event}</p>
                      <p className="font-ui text-xs text-mitti mt-1">
                        Event: {row.event}
                        {' • '}
                        Vars: {Array.isArray(row.varOrder) ? row.varOrder.join(', ') || '' : ''}
                        {' • '}
                        Message ID: {row.templateId || 'Missing'}
                      </p>
                    </div>
                    <label className="font-ui text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!row.active}
                        onChange={(e) => updateTemplate(row.event, { active: e.target.checked })}
                      />
                      Active
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <select
                      value={mappedProviderExists ? row.templateId : ''}
                      onChange={(e) => {
                        const nextMessageId = e.target.value;
                        if (!nextMessageId) return;
                        applyProviderTemplate(row.event, nextMessageId);
                      }}
                      className="border border-kohl/15 px-3 py-2 font-ui text-sm bg-white"
                    >
                      <option value="">Map from Fast2SMS approved template</option>
                      {approvedProviderTemplates.map((provider) => (
                        <option key={provider.messageId} value={provider.messageId}>
                          {providerLabel(provider)}
                        </option>
                      ))}
                    </select>

                    <input
                      value={row.templateId || ''}
                      onChange={(e) => updateTemplate(row.event, { templateId: e.target.value })}
                      placeholder="DLT template ID / Message ID"
                      className="border border-kohl/15 px-3 py-2 font-ui text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <input
                      value={row.category || ''}
                      onChange={(e) => updateTemplate(row.event, { category: e.target.value })}
                      placeholder="Category"
                      className="border border-kohl/15 px-3 py-2 font-ui text-sm"
                    />
                    <input
                      value={row.notes || ''}
                      onChange={(e) => updateTemplate(row.event, { notes: e.target.value })}
                      placeholder="Notes / provider mapping metadata"
                      className="border border-kohl/15 px-3 py-2 font-ui text-sm"
                    />
                  </div>

                  <textarea
                    value={row.body || ''}
                    onChange={(e) => updateTemplate(row.event, { body: e.target.value })}
                    rows={3}
                    placeholder="Template body"
                    className="w-full mt-3 border border-kohl/15 px-3 py-2 font-ui text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => void saveTemplate(row)}
                    className="mt-3 px-4 py-2 border border-kohl/20 hover:bg-beige font-ui text-sm"
                  >
                    {savingEvent === row.event ? 'Saving' : 'Save template'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white border border-kohl/10 p-5 mb-6">
        <h2 className="font-display text-xl text-kohl mb-3">Imported Fast2SMS Templates</h2>
        {providerTemplates.length === 0 ? (
          <p className="font-ui text-sm text-mitti">No provider templates imported yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm font-ui">
              <thead>
                <tr className="text-left border-b border-kohl/10">
                  <th className="py-2 pr-4">Message ID</th>
                  <th className="py-2 pr-4">Sender</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Body</th>
                </tr>
              </thead>
              <tbody>
                {providerTemplates.map((row, idx) => (
                  <tr key={`${row.messageId}-${idx}`} className="border-b border-kohl/5 align-top">
                    <td className="py-2 pr-4">{row.messageId}</td>
                    <td className="py-2 pr-4">{row.senderId || ''}</td>
                    <td className="py-2 pr-4">{row.category || ''}</td>
                    <td className="py-2 pr-4">{row.status || ''}</td>
                    <td className="py-2 pr-4 whitespace-pre-wrap">{row.body || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-kohl/10 p-5">
        <h2 className="font-display text-xl text-kohl mb-3">Last 50 SMS sent</h2>
        {logs.length === 0 ? (
          <p className="font-ui text-sm text-mitti">No SMS logs available.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm font-ui">
              <thead>
                <tr className="text-left border-b border-kohl/10">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Event</th>
                  <th className="py-2 pr-4">Recipient</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((row, idx) => (
                  <tr key={row.id || `${row.event || 'log'}-${idx}`} className="border-b border-kohl/5">
                    <td className="py-2 pr-4">{row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}</td>
                    <td className="py-2 pr-4">{row.event || ''}</td>
                    <td className="py-2 pr-4">{row.recipient || row.phone || row.to || ''}</td>
                    <td className="py-2 pr-4">{row.status || ''}</td>
                    <td className="py-2 pr-4 text-red-700">{row.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-kohl/10 p-4">
      <p className="label text-mitti">{label}</p>
      <p className="font-display text-kohl mt-2 break-words">{value}</p>
    </div>
  );
}
