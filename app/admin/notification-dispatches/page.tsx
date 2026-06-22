'use client';
// app/admin/notification-dispatches/page.tsx
// v26.3b — Live audit log of every SMS and WhatsApp dispatch.

import { useEffect, useState } from 'react';

interface Dispatch {
  id: string;
  channel: 'sms' | 'whatsapp' | 'email';
  event: string;
  templateName: string;
  recipient: string;
  status: string;
  errorMessage: string | null;
  attempt: number;
  providerRequestId: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  queued:    'bg-mitti/20 text-mitti',
  sent:      'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  read:      'bg-emerald-100 text-emerald-800',
  failed:    'bg-madder/10 text-madder',
};

export default function DispatchLogPage() {
  const [items, setItems] = useState<Dispatch[]>([]);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (channel) params.set('channel', channel);
    if (status)  params.set('status',  status);
    const res = await fetch(`/api/admin/notification-dispatches?${params}`);
    const d = await res.json();
    setItems(d.dispatches || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [channel, status]);

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <h1 className="font-display text-3xl text-kohl">Notification dispatches</h1>
      <p className="text-mitti italic text-sm mt-1 mb-6">
        Live audit log. Every SMS and WhatsApp message lands here with delivery and read receipts.
      </p>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={channel} onChange={e => setChannel(e.target.value)}
                className="border border-mitti/30 px-3 py-2 text-sm">
          <option value="">All channels</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)}
                className="border border-mitti/30 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="queued">queued</option>
          <option value="sent">sent</option>
          <option value="delivered">delivered</option>
          <option value="read">read</option>
          <option value="failed">failed</option>
        </select>
        <button onClick={load} className="border border-mitti/30 px-3 py-2 text-sm">Refresh</button>
      </div>

      {loading ? (
        <p className="text-mitti italic">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-mitti italic">No dispatches yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-mitti/30 bg-beige text-left text-xs uppercase tracking-widest text-mitti">
                <th className="p-3">When</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Event</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Status</th>
                <th className="p-3">Attempt</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map(d => (
                <tr key={d.id} className="border-b border-mitti/10">
                  <td className="p-3 text-xs text-mitti whitespace-nowrap">
                    {new Date(d.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="p-3 uppercase text-xs">{d.channel}</td>
                  <td className="p-3 text-xs">{d.event}</td>
                  <td className="p-3 text-xs font-mono">{d.recipient}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 text-xs ${STATUS_COLOR[d.status] || ''}`}>{d.status}</span>
                  </td>
                  <td className="p-3 text-center text-xs">{d.attempt}</td>
                  <td className="p-3 text-xs italic text-mitti max-w-md truncate">
                    {d.errorMessage || (d.providerRequestId ? `ref: ${d.providerRequestId}` : '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
