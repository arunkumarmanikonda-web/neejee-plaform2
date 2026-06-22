'use client';
import { useEffect, useState } from 'react';
import { Loader2, Clock, CheckCircle2, XCircle, X } from 'lucide-react';

export default function ChangeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/vendor/change-requests', { cache: 'no-store' });
    const d = await r.json();
    setRequests(d.requests || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cancel = async (id: string) => {
    if (!confirm('Cancel this change request?')) return;
    const r = await fetch(`/api/vendor/change-requests/${id}`, { method: 'DELETE' });
    if (r.ok) await load();
  };

  if (loading) return <div className="p-8"><Loader2 className="w-5 h-5 animate-spin text-madder" /></div>;

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-4">
      <h1 className="font-display text-3xl text-kohl">Pending Changes</h1>
      <p className="text-sm text-mitti">Requests you've submitted that require NEEJEE finance team verification before they take effect.</p>

      {requests.length === 0 ? (
        <div className="bg-ivory border border-mitti/15 p-8 text-center text-sm text-mitti italic">No change requests yet.</div>
      ) : (
        <ul className="space-y-3">
          {requests.map(r => (
            <li key={r.id} className="bg-ivory border border-mitti/15 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <StatusBadge status={r.status} />
                <span className="text-[11px] text-mitti">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <table className="w-full text-sm mb-3">
                <thead className="text-[10px] uppercase tracking-widest text-mitti">
                  <tr><th className="text-left p-2">Field</th><th className="text-left p-2">Old value</th><th className="text-left p-2">New value</th></tr>
                </thead>
                <tbody>
                  {(r.fieldChanges || []).map((c: any, i: number) => (
                    <tr key={i} className="border-t border-mitti/10">
                      <td className="p-2 text-xs text-mitti">{c.field}</td>
                      <td className="p-2 font-mono text-xs">{String(c.oldValue ?? '—')}</td>
                      <td className="p-2 font-mono text-xs text-madder">{String(c.newValue ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.reason && <p className="text-xs text-mitti italic mb-2">Reason: {r.reason}</p>}
              {r.reviewNote && (
                <p className="text-xs text-mitti mb-2"><strong>Reviewer note:</strong> {r.reviewNote}</p>
              )}
              {r.supportingDocs?.length > 0 && (
                <div className="text-xs text-mitti">
                  Supporting documents:
                  <ul className="list-disc pl-5 mt-1">
                    {r.supportingDocs.map((d: any) => (
                      <li key={d.id}><a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-madder hover:underline">{d.fileName}</a> ({d.docType.replace(/_/g, ' ')})</li>
                    ))}
                  </ul>
                </div>
              )}
              {r.status === 'PENDING' && (
                <div className="mt-3 pt-3 border-t border-mitti/10">
                  <button onClick={() => cancel(r.id)} className="text-xs text-madder inline-flex items-center gap-1 hover:underline">
                    <X className="w-3 h-3" /> Cancel this request
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED')  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-green-800 bg-green-100 px-2 py-1"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
  if (status === 'REJECTED')  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-madder bg-madder/10 px-2 py-1"><XCircle className="w-3 h-3" /> Rejected</span>;
  if (status === 'CANCELLED') return <span className="text-[10px] uppercase tracking-widest text-mitti">Cancelled</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-mitti bg-haldi/20 px-2 py-1"><Clock className="w-3 h-3" /> Under review</span>;
}
