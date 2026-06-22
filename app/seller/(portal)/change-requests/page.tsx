'use client';
import { useEffect, useState } from 'react';
import { Loader2, Clock, X, Check, XCircle } from 'lucide-react';

const STATUS = {
  PENDING:   { l: 'Pending review', cls: 'bg-banarasi/20 text-banarasi', icon: Clock },
  APPROVED:  { l: 'Approved',       cls: 'bg-emerald-100 text-emerald-800', icon: Check },
  REJECTED:  { l: 'Rejected',       cls: 'bg-madder/10 text-madder', icon: XCircle },
  CANCELLED: { l: 'Cancelled',      cls: 'bg-mitti/10 text-mitti', icon: X },
};

export default function ChangeRequestsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/seller/change-requests');
    const j = await r.json();
    setRows(j.changeRequests || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cancel = async (id: string) => {
    if (!confirm('Cancel this change request?')) return;
    const r = await fetch(`/api/seller/change-requests/${id}`, { method: 'DELETE' });
    if (r.ok) load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl text-kohl">Pending Changes</h1>
        <p className="text-mitti text-sm">Profile edits awaiting admin approval</p>
      </div>

      {loading ? (
        <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          No change requests. Edit your profile to submit one.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const s = (STATUS as any)[r.status];
            const changes = r.fieldChanges as Record<string, { from: any; to: any }>;
            return (
              <div key={r.id} className="bg-ivory border border-mitti/20 p-5 rounded">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="label text-banarasi">
                      Submitted {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-xs ${s.cls}`}>
                      <s.icon className="w-3 h-3" /> {s.l}
                    </span>
                  </div>
                  {r.status === 'PENDING' && (
                    <button onClick={() => cancel(r.id)}
                      className="text-mitti hover:text-madder text-xs font-ui tracking-widest">
                      CANCEL
                    </button>
                  )}
                </div>

                <table className="w-full text-sm">
                  <thead className="text-mitti text-xs label">
                    <tr><th className="text-left pb-1">FIELD</th><th className="text-left pb-1">FROM</th><th className="text-left pb-1">TO</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(changes).map(([k, v]) => (
                      <tr key={k} className="border-t border-mitti/10">
                        <td className="py-1.5 text-kohl">{k}</td>
                        <td className="py-1.5 text-mitti">{String(v.from || '—').slice(0, 40)}</td>
                        <td className="py-1.5 text-kohl font-medium">{String(v.to || '—').slice(0, 40)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {r.reason && <p className="text-xs text-mitti mt-3 italic">Reason: {r.reason}</p>}
                {r.reviewNote && <p className="text-xs text-banarasi mt-2"><strong>Admin note:</strong> {r.reviewNote}</p>}
                {r.supportingDocs?.length > 0 && (
                  <div className="text-xs text-mitti mt-2">
                    {r.supportingDocs.length} supporting document{r.supportingDocs.length === 1 ? '' : 's'} attached
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
