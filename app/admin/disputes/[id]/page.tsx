'use client';
// Admin: Dispute detail with timeline + status actions.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Event = {
  id: string;
  actorRole: string | null;
  type: string;
  body: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  attachments: string[];
  createdAt: string;
};

type Dispute = {
  id: string;
  resourceType: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  evidenceUrls: string[];
  resolutionNote: string | null;
  resolutionAmountPaise: number | null;
  resolvedAt: string | null;
  dueBy: string | null;
  raisedByRole: string;
  createdAt: string;
  events: Event[];
  order: { id: string; orderNumber: string; total: number; status: string } | null;
  purchaseOrder: { id: string; poNumber: string; status: string } | null;
};

const STATUS_OPTIONS = ['OPEN', 'AWAITING_CUSTOMER', 'AWAITING_VENDOR', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'];

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/disputes/${id}`);
    const data = await res.json();
    setDispute(data.dispute);
    setVendor(data.vendor);
    setCustomer(data.customer);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function postComment() {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/admin/disputes/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      });
      if (!res.ok) {
        alert('Failed');
        return;
      }
      setComment('');
      load();
    } finally {
      setPosting(false);
    }
  }

  async function changeStatus(toStatus: string) {
    let note = '';
    let refund = '';
    if (toStatus === 'RESOLVED') {
      note = prompt('Resolution note (will be visible to the raiser):') || '';
      if (!note) return;
      refund = prompt('Refund amount in ₹ (leave blank if none):') || '';
    } else if (toStatus === 'REJECTED') {
      note = prompt('Reason for rejection:') || '';
      if (!note) return;
    }
    const res = await fetch(`/api/admin/disputes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toStatus,
        note,
        resolutionAmountPaise: refund ? Math.round(Number(refund) * 100) : undefined,
      }),
    });
    if (!res.ok) {
      alert('Failed');
      return;
    }
    load();
  }

  if (!dispute) return <div className="p-6">Loading…</div>;

  const inr = (paise: number) =>
    '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/admin/disputes" className="text-xs text-mitti hover:text-madder">
        ← All disputes
      </Link>

      <header className="mt-2 mb-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="font-display text-2xl">{dispute.title}</h1>
            <p className="text-xs text-charcoal/60 mt-1">
              {dispute.resourceType.replace(/_/g, ' ')} · {dispute.category.replace(/_/g, ' ')} ·
              raised by {dispute.raisedByRole} on {new Date(dispute.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-xs px-3 py-1 bg-amber-100 text-amber-700`}>
              {dispute.status.replace(/_/g, ' ')}
            </span>
            <div className="text-xs text-charcoal/60 mt-1">{dispute.severity} severity</div>
          </div>
        </div>
      </header>

      {/* Related resource */}
      <div className="bg-beige/40 p-4 mb-6 text-sm">
        {dispute.order && (
          <div>
            <strong>Order:</strong>{' '}
            <Link href={`/admin/orders/${dispute.order.id}`} className="underline">
              {dispute.order.orderNumber}
            </Link>{' '}
            · {dispute.order.status} · {inr(dispute.order.total)}
          </div>
        )}
        {dispute.purchaseOrder && (
          <div>
            <strong>PO:</strong>{' '}
            <Link href={`/admin/purchase-orders/${dispute.purchaseOrder.id}`} className="underline">
              {dispute.purchaseOrder.poNumber}
            </Link>{' '}
            · {dispute.purchaseOrder.status}
          </div>
        )}
        {customer && (
          <div className="mt-1">
            <strong>Customer:</strong> {customer.name || customer.email}
          </div>
        )}
        {vendor && (
          <div className="mt-1">
            <strong>Vendor:</strong> {vendor.legalName}
          </div>
        )}
      </div>

      {/* Initial description */}
      <div className="border border-charcoal/10 p-4 mb-4">
        <div className="text-xs uppercase text-charcoal/50 mb-2">Initial complaint</div>
        <p className="whitespace-pre-wrap text-sm">{dispute.description}</p>
        {dispute.evidenceUrls.length > 0 && (
          <div className="mt-3">
            <div className="text-xs uppercase text-charcoal/50 mb-1">Evidence</div>
            <div className="flex gap-2 flex-wrap">
              {dispute.evidenceUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs underline">
                  Evidence #{i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="mb-6">
        <h2 className="text-xs uppercase text-charcoal/50 mb-2">Timeline</h2>
        <div className="space-y-2">
          {dispute.events.filter(e => e.type !== 'CREATED').map(e => (
            <div key={e.id} className="border-l-2 border-mitti/30 pl-3 py-1 text-sm">
              <div className="text-xs text-charcoal/50">
                {new Date(e.createdAt).toLocaleString('en-IN')} · {e.actorRole}
                {e.type === 'STATUS_CHANGED' && (
                  <span>
                    {' '}
                    · {e.fromStatus} → {e.toStatus}
                  </span>
                )}
                {e.type === 'RESOLVED' && <span> · marked RESOLVED</span>}
              </div>
              {e.body && <div className="whitespace-pre-wrap mt-1">{e.body}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Resolution */}
      {dispute.status === 'RESOLVED' && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 mb-6">
          <div className="text-xs uppercase text-emerald-700 mb-1">Resolution</div>
          <p className="text-sm">{dispute.resolutionNote}</p>
          {dispute.resolutionAmountPaise && (
            <p className="text-sm mt-1">
              <strong>Refund/credit:</strong> {inr(dispute.resolutionAmountPaise)}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      {!['RESOLVED', 'REJECTED', 'WITHDRAWN'].includes(dispute.status) && (
        <>
          <div className="border border-charcoal/10 p-4 mb-4">
            <div className="text-xs uppercase text-charcoal/50 mb-2">Add a comment</div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              className="w-full border border-charcoal/20 p-2 text-sm"
              placeholder="Note to the raiser…"
            />
            <button onClick={postComment} disabled={posting || !comment.trim()} className="btn-primary mt-2 text-xs">
              {posting ? 'Posting…' : 'POST COMMENT'}
            </button>
          </div>

          <div className="border border-charcoal/10 p-4">
            <div className="text-xs uppercase text-charcoal/50 mb-2">Change status</div>
            <div className="flex gap-2 flex-wrap">
              {STATUS_OPTIONS.filter(s => s !== dispute.status).map(s => (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  className={`text-xs px-3 py-1 border border-charcoal/20 hover:bg-beige/30 ${s === 'RESOLVED' ? 'text-emerald-700' : s === 'REJECTED' ? 'text-rose-700' : ''}`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
