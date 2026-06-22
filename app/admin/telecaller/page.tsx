'use client';
// app/admin/telecaller/page.tsx
// v26.3a — Telecaller dashboard. Queue of T+7d abandoned carts.

import { useEffect, useState } from 'react';

interface Cart {
  id: string;
  email: string;
  customerName: string | null;
  phone: string | null;
  subtotal: number;
  itemCount: number;
  itemsJson: string;
  telecallerStatus: string | null;
  telecallerNotes: string | null;
  telecallerCalledAt: string | null;
  telecallerCallbackAt: string | null;
  discountCode: string | null;
  discountPercent: number | null;
  createdAt: string;
}

const OUTCOMES = [
  { v: 'CONNECTED', label: 'Connected', color: 'bg-green-700' },
  { v: 'NO_PICK',   label: 'No pick',   color: 'bg-yellow-700' },
  { v: 'CALLBACK',  label: 'Callback',  color: 'bg-blue-700' },
  { v: 'CONVERTED', label: 'Converted', color: 'bg-emerald-700' },
  { v: 'LOST',      label: 'Lost',      color: 'bg-mitti' },
];

export default function TelecallerPage() {
  const [carts, setCarts] = useState<Cart[]>([]);
  const [filter, setFilter] = useState<string>('pending');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState('');

  const load = async () => {
    const res = await fetch(`/api/admin/telecaller?outcome=${filter}`);
    const d = await res.json();
    setCarts(d.carts || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);

  const setOutcome = async (id: string, status: string, notes?: string) => {
    await fetch(`/api/admin/abandoned-carts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telecallerStatus: status,
        telecallerNotes: notes !== undefined ? notes : undefined,
        telecallerCalledAt: new Date().toISOString(),
      }),
    });
    await load();
    setOpenId(null);
    setNotesDraft('');
  };

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-kohl">Telecaller queue</h1>
          <p className="font-italic italic text-mitti mt-1 text-sm">Customers who didn't return after 3 emails over 7 days.</p>
        </div>
        <a
          href="/api/admin/telecaller?format=csv"
          className="text-sm border border-mitti/30 px-4 py-2 hover:bg-beige"
        >Export CSV</a>
      </div>

      <div className="flex gap-2 mb-6">
        {['pending', 'CONNECTED', 'NO_PICK', 'CALLBACK', 'CONVERTED', 'LOST'].map(o => (
          <button
            key={o}
            onClick={() => setFilter(o)}
            className={`px-3 py-1 text-xs uppercase tracking-widest border ${filter === o ? 'bg-kohl text-ivory border-kohl' : 'border-mitti/30 text-mitti'}`}
          >{o.toLowerCase().replace('_', ' ')}</button>
        ))}
      </div>

      {carts.length === 0 ? (
        <p className="text-mitti italic">No customers in this state.</p>
      ) : (
        <div className="space-y-4">
          {carts.map(c => {
            const days = Math.floor((Date.now() - new Date(c.createdAt).getTime()) / (24 * 60 * 60 * 1000));
            let items: any[] = [];
            try { items = JSON.parse(c.itemsJson)?.verifiedItems || []; } catch {}
            const craftRegions = Array.from(new Set(
              items.map(i => [i.craft, i.region].filter(Boolean).join(' · ')).filter(s => s)
            )).slice(0, 3);

            return (
              <div key={c.id} className="border border-mitti/30 p-5 bg-ivory">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display text-xl text-kohl">{c.customerName || c.email}</h3>
                    <div className="text-xs text-mitti mt-1">
                      <a href={`mailto:${c.email}`} className="underline">{c.email}</a>
                      {c.phone && <> · <a href={`tel:${c.phone}`} className="underline">{c.phone}</a></>}
                      <> · {days} day{days !== 1 ? 's' : ''} waiting</>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-2xl text-kohl">
                      ₹{(c.subtotal / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-mitti">{c.itemCount} item{c.itemCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                {craftRegions.length > 0 && (
                  <div className="bg-beige p-3 mb-3">
                    <div className="text-xs uppercase tracking-widest text-mitti mb-1">Talking points</div>
                    <ul className="text-sm text-kohl">
                      {craftRegions.map((cr, i) => <li key={i} className="italic">— {cr}</li>)}
                    </ul>
                  </div>
                )}

                {c.discountCode && (
                  <div className="mb-3 text-xs text-madder">
                    Customer was offered code <span className="font-mono">{c.discountCode}</span> ({c.discountPercent}% off)
                  </div>
                )}

                <div className="border-t border-mitti/20 pt-3 mt-3">
                  {c.telecallerStatus ? (
                    <div className="text-sm">
                      <span className="text-mitti">Last outcome: </span>
                      <span className="text-kohl font-medium">{c.telecallerStatus}</span>
                      {c.telecallerCalledAt && <span className="text-mitti"> · {new Date(c.telecallerCalledAt).toLocaleString('en-IN')}</span>}
                      {c.telecallerNotes && <p className="italic text-mitti mt-2 text-sm">"{c.telecallerNotes}"</p>}
                      <button onClick={() => { setOpenId(c.id); setNotesDraft(c.telecallerNotes || ''); }} className="text-xs underline ml-3">Update</button>
                    </div>
                  ) : (
                    <div>
                      {openId === c.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={notesDraft}
                            onChange={e => setNotesDraft(e.target.value)}
                            placeholder="Notes from the call…"
                            className="w-full border border-mitti/30 p-2 text-sm"
                            rows={3}
                          />
                          <div className="flex flex-wrap gap-2">
                            {OUTCOMES.map(o => (
                              <button
                                key={o.v}
                                onClick={() => setOutcome(c.id, o.v, notesDraft)}
                                className={`${o.color} text-ivory px-3 py-1 text-xs uppercase tracking-widest`}
                              >{o.label}</button>
                            ))}
                            <button onClick={() => setOpenId(null)} className="text-xs text-mitti underline ml-2">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setOpenId(c.id)} className="text-sm bg-kohl text-ivory px-4 py-2">Log call</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
