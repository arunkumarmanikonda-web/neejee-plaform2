'use client';
import { useEffect, useState } from 'react';
import { Loader2, Mail, MessageCircle, Smartphone, CheckCircle2, XCircle, Clock, Filter } from 'lucide-react';

export default function NotificationsLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', channel: '', event: '', q: '' });

  const load = async () => {
    setLoading(true);
    const url = new URL('/api/admin/notifications/logs', window.location.origin);
    if (filters.status)  url.searchParams.set('status', filters.status);
    if (filters.channel) url.searchParams.set('channel', filters.channel);
    if (filters.event)   url.searchParams.set('event', filters.event);
    if (filters.q)       url.searchParams.set('q', filters.q);
    const r = await fetch(url.toString(), { cache: 'no-store' });
    const d = await r.json();
    setLogs(d.logs || []);
    setSummary(d.summary || {});
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filters.status, filters.channel, filters.event]);

  return (
    <div className="max-w-6xl mx-auto p-6 lg:p-8 space-y-5">
      <header>
        <h1 className="font-display text-3xl text-kohl">Notification logs</h1>
        <p className="text-sm text-mitti mt-1">Every email / WhatsApp / SMS attempt across the platform.</p>
      </header>

      {/* Summary (last 24h) */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Sent (24h)"    value={summary.SENT      ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-green-700" />} />
        <SummaryCard label="Delivered"     value={summary.DELIVERED ?? 0} icon={<CheckCircle2 className="w-5 h-5 text-green-700" />} />
        <SummaryCard label="Queued"        value={summary.QUEUED    ?? 0} icon={<Clock className="w-5 h-5 text-mitti" />} />
        <SummaryCard label="Failed"        value={summary.FAILED    ?? 0} icon={<XCircle className="w-5 h-5 text-madder" />} />
        <SummaryCard label="Skipped"       value={summary.SKIPPED   ?? 0} icon={<XCircle className="w-5 h-5 text-mitti" />} />
      </section>

      {/* Filters */}
      <section className="bg-ivory border border-mitti/15 p-4 flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-mitti" />
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="p-2 bg-beige border border-mitti/20 text-sm">
          <option value="">All statuses</option>
          <option value="SENT">Sent</option>
          <option value="DELIVERED">Delivered</option>
          <option value="QUEUED">Queued</option>
          <option value="FAILED">Failed</option>
          <option value="SKIPPED">Skipped</option>
          <option value="BOUNCED">Bounced</option>
        </select>
        <select value={filters.channel} onChange={e => setFilters({ ...filters, channel: e.target.value })} className="p-2 bg-beige border border-mitti/20 text-sm">
          <option value="">All channels</option>
          <option value="EMAIL">Email</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="SMS">SMS</option>
        </select>
        <select value={filters.event} onChange={e => setFilters({ ...filters, event: e.target.value })} className="p-2 bg-beige border border-mitti/20 text-sm">
          <option value="">All events</option>
          <option value="ORDER_PLACED">Order placed</option>
          <option value="ORDER_SHIPPED">Order shipped</option>
          <option value="ORDER_DELIVERED">Order delivered</option>
          <option value="ORDER_CANCELLED">Order cancelled</option>
          <option value="ORDER_REFUNDED">Order refunded</option>
          <option value="PO_SENT">PO sent</option>
          <option value="PO_CONFIRMED">PO confirmed</option>
          <option value="PO_DISPATCHED">PO dispatched</option>
          <option value="PO_RECEIVED">PO received</option>
          <option value="PO_CLOSED">PO closed</option>
          <option value="PO_CANCELLED">PO cancelled</option>
          <option value="CHANGE_REQUEST_SUBMITTED">Change request submitted</option>
          <option value="CHANGE_REQUEST_APPROVED">Change request approved</option>
          <option value="CHANGE_REQUEST_REJECTED">Change request rejected</option>
          <option value="DOC_APPROVED">Document approved</option>
          <option value="DOC_REJECTED">Document rejected</option>
          <option value="TEAM_INVITED">Team invited</option>
          <option value="PAYOUT_SCHEDULED">Payout scheduled</option>
          <option value="PAYOUT_PAID">Payout paid</option>
        </select>
        <form onSubmit={e => { e.preventDefault(); load(); }} className="flex items-center gap-2">
          <input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder="Search recipient..." className="p-2 bg-beige border border-mitti/20 text-sm" />
          <button type="submit" className="btn-ghost text-xs">Search</button>
        </form>
      </section>

      {/* Logs table */}
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-madder" />
      ) : logs.length === 0 ? (
        <p className="text-sm text-mitti italic p-6 bg-ivory border border-mitti/15">No logs match these filters.</p>
      ) : (
        <div className="bg-ivory border border-mitti/15 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-beige text-[10px] uppercase tracking-widest text-mitti">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Event</th>
                <th className="text-left p-3">Channel</th>
                <th className="text-left p-3">Recipient</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-t border-mitti/10 hover:bg-beige/40">
                  <td className="p-3 text-[11px] text-mitti whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="p-3 text-xs font-mono">{l.event}</td>
                  <td className="p-3"><ChannelIcon channel={l.channel} /></td>
                  <td className="p-3 text-xs truncate max-w-[14rem]">{l.recipient}</td>
                  <td className="p-3"><StatusPill status={l.status} /></td>
                  <td className="p-3 text-xs text-mitti max-w-md">
                    {l.subject && <div className="truncate">{l.subject}</div>}
                    {l.errorMessage && <div className="text-madder truncate" title={l.errorMessage}>{l.errorMessage}</div>}
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

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-ivory border border-mitti/15 p-3">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-[10px] uppercase tracking-widest text-mitti">{label}</span></div>
      <p className="font-display text-2xl text-kohl">{value}</p>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === 'EMAIL')    return <span className="inline-flex items-center gap-1 text-xs text-mitti"><Mail className="w-3 h-3" /> Email</span>;
  if (channel === 'WHATSAPP') return <span className="inline-flex items-center gap-1 text-xs text-mitti"><MessageCircle className="w-3 h-3" /> WhatsApp</span>;
  if (channel === 'SMS')      return <span className="inline-flex items-center gap-1 text-xs text-mitti"><Smartphone className="w-3 h-3" /> SMS</span>;
  return <span className="text-xs text-mitti">{channel}</span>;
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    SENT:      'bg-green-100 text-green-800',
    DELIVERED: 'bg-green-100 text-green-800',
    QUEUED:    'bg-haldi/20 text-mitti',
    FAILED:    'bg-madder/10 text-madder',
    SKIPPED:   'bg-mitti/15 text-mitti',
    BOUNCED:   'bg-madder/10 text-madder',
  };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 ${styles[status] || ''}`}>{status}</span>;
}
