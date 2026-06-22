'use client';
import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Clock, FileText, ExternalLink } from 'lucide-react';

const STATUS_TABS = [
  { key: 'PENDING',  label: 'Pending review' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

export default function AdminChangeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [tab, setTab] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{ id: string; action: 'APPROVE' | 'REJECT' } | null>(null);
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    const url = new URL('/api/admin/vendor-change-requests', window.location.origin);
    url.searchParams.set('status', tab);
    const r = await fetch(url.toString(), { cache: 'no-store' });
    const d = await r.json();
    setRequests(d.requests || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const review = async () => {
    if (!reviewModal) return;
    setBusyId(reviewModal.id);
    try {
      const r = await fetch(`/api/admin/vendor-change-requests/${reviewModal.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: reviewModal.action, note }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d?.error || 'Failed'); return; }
      setReviewModal(null); setNote('');
      await load();
    } finally { setBusyId(null); }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-4">
      <header>
        <h1 className="font-display text-3xl text-kohl">Vendor change requests</h1>
        <p className="text-sm text-mitti mt-1">
          Review proposed changes to vendor bank, GST, PAN, address, and legal name. Always verify against the attached supporting documents before approving.
        </p>
      </header>

      <div className="flex gap-2">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[10px] uppercase tracking-widest border ${tab === t.key ? 'bg-madder text-ivory border-madder' : 'bg-beige border-mitti/20 text-mitti'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-madder" />
      ) : requests.length === 0 ? (
        <p className="text-sm text-mitti italic">No {tab.toLowerCase()} requests.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map(r => (
            <li key={r.id} className="bg-ivory border border-mitti/15 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-display text-lg text-kohl">{r.vendor.displayName || r.vendor.legalName}</p>
                  <p className="text-[11px] text-mitti">{r.vendor.contactEmail} · submitted {new Date(r.createdAt).toLocaleString()}{r.requestedOnBehalf ? ' · admin filed on behalf' : ''}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>

              <table className="w-full text-sm mb-3">
                <thead className="text-[10px] uppercase tracking-widest text-mitti">
                  <tr><th className="text-left p-2">Field</th><th className="text-left p-2">Current</th><th className="text-left p-2">Proposed</th></tr>
                </thead>
                <tbody>
                  {(r.fieldChanges || []).map((c: any, i: number) => (
                    <tr key={i} className="border-t border-mitti/10">
                      <td className="p-2 text-mitti text-xs">{c.field}</td>
                      <td className="p-2 font-mono text-xs">{String(c.oldValue ?? '—')}</td>
                      <td className="p-2 font-mono text-xs text-madder">{String(c.newValue ?? '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {r.reason && <p className="text-xs text-mitti italic mb-2">Vendor reason: {r.reason}</p>}

              {r.supportingDocs?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-widest text-mitti mb-1">Supporting documents</p>
                  <ul className="space-y-1">
                    {r.supportingDocs.map((d: any) => (
                      <li key={d.id} className="text-xs">
                        <a href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-madder hover:underline">
                          <FileText className="w-3 h-3" /> {d.fileName}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <span className="text-mitti ml-2">{d.docType.replace(/_/g, ' ')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {r.reviewNote && <p className="text-xs text-mitti mb-2"><strong>Review note:</strong> {r.reviewNote}</p>}

              {r.status === 'PENDING' && (
                <div className="flex gap-2 pt-3 border-t border-mitti/10">
                  <button onClick={() => { setReviewModal({ id: r.id, action: 'APPROVE' }); setNote(''); }} disabled={busyId === r.id} className="btn-primary text-xs inline-flex items-center gap-1 disabled:opacity-50">
                    <CheckCircle2 className="w-3 h-3" /> APPROVE
                  </button>
                  <button onClick={() => { setReviewModal({ id: r.id, action: 'REJECT' }); setNote(''); }} disabled={busyId === r.id} className="btn-ghost text-xs text-madder inline-flex items-center gap-1 disabled:opacity-50">
                    <XCircle className="w-3 h-3" /> REJECT
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {reviewModal && (
        <div className="fixed inset-0 bg-kohl/40 z-50 flex items-center justify-center p-4">
          <div className="bg-ivory max-w-md w-full p-6 space-y-3">
            <h2 className="font-display text-xl text-kohl">
              {reviewModal.action === 'APPROVE' ? 'Approve change' : 'Reject change'}
            </h2>
            <p className="text-xs text-mitti">
              {reviewModal.action === 'APPROVE'
                ? 'The new values will be applied to the vendor profile and the attached documents will be marked APPROVED.'
                : 'The vendor will be notified. The request and its documents will move to REJECTED.'}
            </p>
            <label className="block">
              <span className="text-[10px] uppercase tracking-widest text-mitti">Note (optional, visible to vendor)</span>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="mt-1 w-full p-2 bg-beige border border-mitti/20 text-sm" />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setReviewModal(null)} className="btn-ghost text-xs">Cancel</button>
              <button onClick={review} disabled={busyId === reviewModal.id} className={`btn-primary text-xs inline-flex items-center gap-2 disabled:opacity-50 ${reviewModal.action === 'REJECT' ? '!bg-madder' : ''}`}>
                {busyId === reviewModal.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                CONFIRM {reviewModal.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:   'bg-haldi/20 text-mitti',
    APPROVED:  'bg-green-100 text-green-800',
    REJECTED:  'bg-madder/10 text-madder',
    CANCELLED: 'bg-mitti/15 text-mitti',
  };
  const Icon = status === 'APPROVED' ? CheckCircle2 : status === 'REJECTED' ? XCircle : Clock;
  return <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest px-2 py-1 ${styles[status]}`}><Icon className="w-3 h-3" /> {status}</span>;
}
