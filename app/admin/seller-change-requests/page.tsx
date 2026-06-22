'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, X, FileText } from 'lucide-react';

export default function SellerChangeRequestsAdminPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    const r = await fetch(`/api/admin/seller-change-requests?${params}`);
    const j = await r.json();
    setRows(j.changeRequests || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    let note = '';
    if (action === 'reject') {
      note = prompt('Reason for rejection?') || '';
      if (!note) return;
    } else {
      note = prompt('Note (optional)') || '';
    }
    setBusy(id);
    const r = await fetch(`/api/admin/seller-change-requests/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    const j = await r.json();
    setBusy('');
    if (!r.ok) { alert(j.error); return; }
    setMsg(`Request ${action}d`);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-kohl">Seller Change Requests</h1>
        <p className="text-mitti text-sm">Profile edits awaiting your review</p>
      </div>

      <div className="flex gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', ''].map(s => (
          <button key={s || 'all'} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase ${
              filter === s ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'
            }`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}

      {loading ? (
        <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          Empty.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const changes = r.fieldChanges as Record<string, { from: any; to: any }>;
            return (
              <div key={r.id} className="bg-ivory border border-mitti/20 p-5 rounded">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <Link href={`/admin/sellers/${r.seller.id}`} className="font-display text-lg text-kohl hover:underline">
                      {r.seller.businessName}
                    </Link>
                    <p className="text-mitti text-xs">
                      Submitted {new Date(r.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  {r.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button onClick={() => act(r.id, 'approve')} disabled={busy === r.id}
                        className="bg-emerald-600 text-white px-3 py-1.5 text-xs tracking-widest font-ui disabled:opacity-50 flex items-center gap-1">
                        <Check className="w-3 h-3" /> APPROVE
                      </button>
                      <button onClick={() => act(r.id, 'reject')} disabled={busy === r.id}
                        className="bg-madder text-white px-3 py-1.5 text-xs tracking-widest font-ui disabled:opacity-50 flex items-center gap-1">
                        <X className="w-3 h-3" /> REJECT
                      </button>
                    </div>
                  )}
                </div>

                <table className="w-full text-sm">
                  <thead className="text-mitti text-xs label">
                    <tr><th className="text-left pb-1">FIELD</th><th className="text-left pb-1">FROM</th><th className="text-left pb-1">TO</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(changes).map(([k, v]) => (
                      <tr key={k} className="border-t border-mitti/10">
                        <td className="py-1.5 text-kohl font-medium">{k}</td>
                        <td className="py-1.5 text-mitti">{String(v.from || '—').slice(0, 50)}</td>
                        <td className="py-1.5 text-kohl">{String(v.to || '—').slice(0, 50)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {r.reason && <p className="text-xs text-mitti mt-3"><strong>Reason:</strong> {r.reason}</p>}
                {r.supportingDocs?.length > 0 && (
                  <div className="text-xs text-mitti mt-2 flex gap-2 flex-wrap">
                    <strong>Documents:</strong>
                    {r.supportingDocs.map((d: any) => (
                      <a key={d.id} href={d.fileUrl} target="_blank" rel="noreferrer"
                        className="hover:underline flex items-center gap-1 text-banarasi">
                        <FileText className="w-3 h-3" /> {d.docType.replace(/_/g, ' ')}
                      </a>
                    ))}
                  </div>
                )}
                {r.reviewNote && <p className="text-xs text-banarasi mt-2"><strong>Admin note:</strong> {r.reviewNote}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
