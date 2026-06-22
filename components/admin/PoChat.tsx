'use client';
// PoChat — embeddable PO message thread.
// Used by both admin (/admin/purchase-orders/[id]) and vendor (/vendor/purchase-orders/[id]).
// Auto-polls every 30s so both sides see new messages quickly.

import { useEffect, useRef, useState } from 'react';

export type PoChatProps = {
  purchaseOrderId: string;
  // 'admin' or 'vendor' — determines the API endpoint
  side: 'admin' | 'vendor';
};

type Message = {
  id: string;
  authorRole: string;
  authorName: string;
  body: string;
  attachments: string[];
  readByAdminAt: string | null;
  readByVendorAt: string | null;
  createdAt: string;
};

export default function PoChat({ purchaseOrderId, side }: PoChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const apiBase =
    side === 'admin'
      ? `/api/admin/purchase-orders/${purchaseOrderId}/messages`
      : `/api/vendor/purchase-orders/${purchaseOrderId}/messages`;

  async function load() {
    try {
      const res = await fetch(apiBase, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [purchaseOrderId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      if (!res.ok) {
        alert('Failed to send');
        return;
      }
      setText('');
      load();
    } finally {
      setSending(false);
    }
  }

  const isMine = (m: Message) => {
    if (side === 'admin') return m.authorRole === 'ADMIN' || m.authorRole === 'SUPER_ADMIN';
    return m.authorRole === 'VENDOR' || m.authorRole === 'VENDOR_STAFF';
  };

  return (
    <div className="border border-charcoal/10 bg-ivory">
      <div className="px-4 py-2 border-b border-charcoal/10 bg-beige/40">
        <div className="text-xs uppercase text-charcoal/60">PO conversation</div>
      </div>
      <div className="p-4 h-96 overflow-y-auto bg-beige/10">
        {messages.length === 0 && (
          <div className="text-center text-sm text-charcoal/40 py-8">
            No messages yet. Start the conversation below.
          </div>
        )}
        <div className="space-y-3">
          {messages.map(m => {
            const mine = isMine(m);
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-md px-3 py-2 text-sm ${mine ? 'bg-mitti/10 border border-mitti/30' : 'bg-ivory border border-charcoal/10'}`}>
                  <div className="text-xs text-charcoal/60 mb-1">
                    <strong>{m.authorName}</strong> · {m.authorRole.replace('_', ' ').toLowerCase()} ·{' '}
                    {new Date(m.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  {m.attachments.length > 0 && (
                    <div className="mt-1 flex gap-2 flex-wrap">
                      {m.attachments.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer" className="text-xs underline">
                          Attachment #{i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="p-3 border-t border-charcoal/10">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Type a message…"
          className="w-full border border-charcoal/20 p-2 text-sm"
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
          }}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-charcoal/40">{text.length}/2000 · Cmd/Ctrl+Enter to send</span>
          <button onClick={send} disabled={sending || !text.trim()} className="btn-primary text-xs">
            {sending ? 'Sending…' : 'SEND'}
          </button>
        </div>
      </div>
    </div>
  );
}
