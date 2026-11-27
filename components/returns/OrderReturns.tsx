'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { RETURN_REASONS, type ReturnReason } from '@/lib/returns/request';

type Line = {
  id: string; name: string; variant: string; quantity: number; policy: string | null;
  reasons: ReturnReason[]; request: { reference: string; status: string; message: string | null; customerReply: string | null } | null;
};
type Order = { status: string; items: Line[] };

const label = (status: string) => status.toLowerCase().replace(/_/g, ' ');
const field = 'w-full border border-mitti/25 bg-ivory p-2 mt-1 rounded';

export function OrderReturns({ orderNumber }: { orderNumber: string }) {
  const endpoint = `/api/order-returns/${encodeURIComponent(orderNumber)}`;
  const [order, setOrder] = useState<Order | null>(null);
  const [active, setActive] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const pendingReply = useRef<{ draft: string; key: string } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setOrder(null); setActive(''); setError('');
    fetch(endpoint, { cache: 'no-store', signal: abort.signal })
      .then(async res => {
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Unable to open returns.');
        if (!abort.signal.aborted) setOrder(result);
      }).catch(err => { if (!abort.signal.aborted) setError(err.message || 'Unable to open returns.'); });
    return () => abort.abort();
  }, [endpoint, revision]);

  async function send(event: FormEvent<HTMLFormElement>, item: Line) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(''); setNotice(''); setBusy(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, reason: data.get('reason'), quantity: Number(data.get('quantity')), note: data.get('note') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send your request.');
      setNotice('Your request is with our team. You can check its progress here.');
      setRevision(n => n + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to send your request.'); }
    finally { setBusy(false); }
  }

  async function reply(event: FormEvent<HTMLFormElement>, item: Line) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = String(new FormData(form).get('reply') || '').trim();
    const draft = JSON.stringify([item.id, message]);
    setError(''); setNotice(''); setBusy(true);
    try {
      if (pendingReply.current?.draft !== draft) pendingReply.current = { draft, key: crypto.randomUUID() };
      const response = await fetch(endpoint, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, message, replyId: pendingReply.current.key }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send your reply.');
      pendingReply.current = null; form.reset();
      setNotice('Your reply has been added to the request.'); setRevision(n => n + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to send your reply.'); }
    finally { setBusy(false); }
  }

  return <section id="order-returns" className="mt-10 rounded bg-beige/60 p-5 sm:p-7" aria-label="Returns and help">
    <h2 className="font-display text-2xl text-kohl">Returns &amp; help</h2>
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
    {error && <p role="alert" className="mt-3 text-madder">{error}</p>}
    {!order && !error && <p className="mt-3 text-sm" role="status">Opening your order…</p>}
    {order && <>
      <p className="mt-2 text-sm">Order status · {label(order.status)}</p>
      {order.status !== 'DELIVERED' && <p className="mt-2 text-sm">Return requests open once a piece has been delivered. Contact us if you need help with delivery.</p>}
      <ul className="mt-4 space-y-3">{order.items.filter(item => item.request || item.reasons.length > 0).map(item =>
        <li key={item.id} className="rounded bg-ivory p-4">
          <h3 className="font-display text-xl">{item.name}</h3>
          <p className="text-sm text-mitti">{[item.variant, `Quantity ${item.quantity}`].filter(Boolean).join(' · ')}</p>
          {item.request ? <div className="mt-3 text-sm"><p className="font-medium">Request {label(item.request.status)}</p>
            <p className="break-all">Reference · {item.request.reference}</p>
            {item.request.message && <p className="mt-2 whitespace-pre-line">{item.request.message}</p>}
            {item.request.customerReply && <p className="mt-2 whitespace-pre-line">Your latest reply · {item.request.customerReply}</p>}
            {!['RESOLVED','REJECTED','WITHDRAWN'].includes(item.request.status) && <form onSubmit={e => reply(e, item)} className="mt-4">
              <label>Reply to the team<textarea name="reply" required maxLength={2000} rows={2} className={field} /></label>
              <button className="btn-secondary mt-2" disabled={busy}>Send reply</button>
            </form>}</div>
          : <>
            {item.policy && <p className="mt-2 text-sm">{item.policy}</p>}
            {!item.reasons.includes('RETURN') && <p className="mt-2 text-sm">This piece is marked non-returnable. Tell us if it arrived damaged or incorrect.</p>}
            {active !== item.id ? <button type="button" className="btn-secondary mt-3" onClick={() => { setActive(item.id); setError(''); }}>Return or report a problem</button>
            : <form className="mt-4 grid gap-3 text-sm" onSubmit={e => send(e, item)}>
              <label>How can we help?<select name="reason" className={field}>{item.reasons.map(reason => <option value={reason} key={reason}>{RETURN_REASONS[reason]}</option>)}</select></label>
              <label>Quantity<input type="number" min="1" max={item.quantity} defaultValue="1" name="quantity" required className={field} /></label>
              <label>Anything we should know? (optional)<textarea name="note" maxLength={2000} rows={3} className={field} /></label>
              <div className="flex gap-3 flex-wrap"><button className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => setActive('')}>Cancel</button></div>
            </form>}
          </>}
        </li>)}</ul>
    </>}
    <Link className="mt-4 inline-block text-sm text-madder" href="/help/contact">Contact the team about this order</Link>
  </section>;
}
