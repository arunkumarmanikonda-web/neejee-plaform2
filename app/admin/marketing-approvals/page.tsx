'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, X, Eye, Mail, Tag, Image as ImageIcon, Megaphone } from 'lucide-react';

const TYPE_ICON: Record<string, any> = {
  CAMPAIGN: Megaphone,
  EMAIL_BROADCAST: Mail,
  COUPON: Tag,
  BANNER: ImageIcon,
};

const STATUS: Record<string, { l: string; cls: string }> = {
  PENDING:   { l: 'Pending review', cls: 'bg-banarasi/20 text-banarasi' },
  APPROVED:  { l: 'Approved',       cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED:  { l: 'Rejected',       cls: 'bg-madder/10 text-madder' },
  WITHDRAWN: { l: 'Withdrawn',      cls: 'bg-mitti/10 text-mitti' },
};

export default function MarketingApprovalsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [previewing, setPreviewing] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    const r = await fetch(`/api/admin/marketing/approvals?${params}`);
    const j = await r.json();
    setRows(j.requests || []);
    setCounts(j.counts || []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const countOf = (s: string) => counts.find(c => c.status === s)?._count._all || 0;

  const act = async (id: string, action: 'approve' | 'reject' | 'withdraw') => {
    let note = '';
    if (action === 'reject') {
      note = prompt('Reason for rejection?') || '';
      if (!note) return;
    } else {
      const v = prompt(action === 'approve' ? 'Approval note (optional)' : 'Withdraw note (optional)');
      note = v || '';
    }
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/marketing/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMsg(`Request ${action}d`);
      load();
    } catch (e: any) {
      setMsg('Error: ' + e.message);
    } finally { setBusy(''); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-kohl">Marketing Approvals</h1>
        <p className="text-mitti text-sm">Campaigns, broadcasts, coupons & banners awaiting approval</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', ''].map(s => (
          <button key={s || 'all'} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase flex items-center gap-2 ${
              filter === s ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'
            }`}>
            {s ? STATUS[s].l : 'All'}
            {s && <span className="bg-banarasi/30 text-kohl text-[10px] px-1.5 py-0.5 rounded">{countOf(s)}</span>}
          </button>
        ))}
      </div>

      {msg && <div className="bg-emerald-50 border border-emerald-200 p-3 text-sm">{msg}</div>}

      {loading ? (
        <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          Empty queue.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const Icon = TYPE_ICON[r.resourceType] || Megaphone;
            const stat = STATUS[r.status];
            const payload = r.proposedPayload || {};
            return (
              <div key={r.id} className="bg-ivory border border-mitti/20 p-5 rounded">
                <div className="flex items-start gap-3 mb-3">
                  <Icon className="w-5 h-5 text-banarasi mt-1" />
                  <div className="flex-1">
                    <p className="font-display text-lg text-kohl">
                      {payload.name || payload.title || payload.subject || 'Untitled'}
                    </p>
                    <p className="text-mitti text-xs mt-0.5">
                      {r.resourceType.replace(/_/g, ' ')} ·
                      submitted by <strong>{r.createdBy?.email || r.createdByUserId}</strong> ·
                      {' '}{new Date(r.createdAt).toLocaleString('en-IN')}
                    </p>
                    {payload.subject && payload.subject !== payload.name && (
                      <p className="text-mitti text-sm mt-1">Subject: <span className="italic">{payload.subject}</span></p>
                    )}
                    {payload.recipientCount != null && (
                      <p className="text-mitti text-xs mt-1">Audience: <strong>{payload.recipientCount}</strong> recipients</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] tracking-widest ${stat.cls}`}>{stat.l}</span>
                  </div>
                </div>

                {r.reviewNote && (
                  <p className="text-xs text-banarasi mt-2 italic"><strong>Reviewer note:</strong> {r.reviewNote}</p>
                )}

                <div className="flex gap-2 mt-3">
                  <button onClick={() => setPreviewing(previewing?.id === r.id ? null : r)}
                    className="border border-kohl text-kohl px-3 py-1.5 text-xs tracking-widest font-ui flex items-center gap-1">
                    <Eye className="w-3 h-3" /> {previewing?.id === r.id ? 'HIDE' : 'PREVIEW'}
                  </button>
                  {r.status === 'PENDING' && (
                    <>
                      <button onClick={() => act(r.id, 'approve')} disabled={busy === r.id}
                        className="bg-emerald-600 text-white px-3 py-1.5 text-xs tracking-widest font-ui flex items-center gap-1 disabled:opacity-50">
                        <Check className="w-3 h-3" /> APPROVE
                      </button>
                      <button onClick={() => act(r.id, 'reject')} disabled={busy === r.id}
                        className="bg-madder text-white px-3 py-1.5 text-xs tracking-widest font-ui flex items-center gap-1 disabled:opacity-50">
                        <X className="w-3 h-3" /> REJECT
                      </button>
                      <button onClick={() => act(r.id, 'withdraw')} disabled={busy === r.id}
                        className="border border-mitti/40 text-mitti px-3 py-1.5 text-xs tracking-widest font-ui disabled:opacity-50">
                        WITHDRAW
                      </button>
                    </>
                  )}
                  {r.status === 'APPROVED' && r.resourceType === 'EMAIL_BROADCAST' && (
                    <Link href={`/admin/marketing?approvalId=${r.id}&campaignId=${r.resourceId}`}
                      className="bg-kohl text-ivory px-3 py-1.5 text-xs tracking-widest font-ui">
                      OPEN TO SEND →
                    </Link>
                  )}
                </div>

                {previewing?.id === r.id && (
                  <div className="mt-4 pt-4 border-t border-mitti/20">
                    <p className="label text-banarasi mb-2">PAYLOAD</p>
                    {payload.bodyHtml ? (
                      <div className="border border-mitti/20 rounded bg-beige/30 p-4 max-h-96 overflow-y-auto">
                        <div dangerouslySetInnerHTML={{ __html: payload.bodyHtml }} />
                      </div>
                    ) : (
                      <pre className="bg-beige/30 p-3 rounded text-xs overflow-x-auto">{JSON.stringify(payload, null, 2)}</pre>
                    )}
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
