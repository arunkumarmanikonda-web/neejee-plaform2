'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

const ACTION_LABELS: Record<string, string> = {
  PROFILE_DIRECT_EDIT: 'Profile updated',
  CHANGE_REQUEST_SUBMITTED: 'Change request submitted',
  CHANGE_REQUEST_APPROVED: 'Change request approved',
  CHANGE_REQUEST_REJECTED: 'Change request rejected',
  CHANGE_REQUEST_CANCELLED: 'Change request cancelled',
  DOCUMENT_UPLOADED: 'Document uploaded',
  DOCUMENT_DELETED: 'Document deleted',
  INVENTORY_SUBMITTED: 'Inventory submitted',
  INVENTORY_REVIEW: 'Inventory picked up for review',
  INVENTORY_NEEDS_INFO: 'Inventory needs more info',
  INVENTORY_APPROVED: 'Inventory approved',
  INVENTORY_REJECTED: 'Inventory rejected',
  INVENTORY_PUBLISH: 'Inventory published live',
  TEAM_INVITED: 'Team member invited',
  TEAM_REMOVED: 'Team member removed',
  PASSWORD_CHANGED: 'Password changed',
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/seller/activity');
      const j = await r.json();
      setLogs(j.logs || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl text-kohl">Activity Log</h1>
        <p className="text-mitti text-sm">Every action taken on your studio account</p>
      </div>

      {loading ? (
        <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : logs.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          No activity yet.
        </div>
      ) : (
        <div className="bg-ivory border border-mitti/20 rounded overflow-hidden">
          <table className="w-full font-ui text-sm">
            <thead className="bg-beige/50 text-mitti text-xs label">
              <tr>
                <th className="text-left p-3">WHEN</th>
                <th className="text-left p-3">ACTION</th>
                <th className="text-left p-3">DETAILS</th>
                <th className="text-left p-3">ACTOR</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-t border-mitti/10">
                  <td className="p-3 text-mitti text-xs whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 text-kohl">{ACTION_LABELS[l.action] || l.action}</td>
                  <td className="p-3 text-mitti text-xs">
                    {l.details ? Object.entries(l.details).filter(([k]) => k !== 'submissionId' && k !== 'changeRequestId' && k !== 'docId').slice(0, 2).map(([k, v]) => (
                      <div key={k}>{k}: {Array.isArray(v) ? v.join(', ') : String(v).slice(0, 50)}</div>
                    )) : '—'}
                  </td>
                  <td className="p-3 text-mitti text-xs">{l.actorRole || 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
