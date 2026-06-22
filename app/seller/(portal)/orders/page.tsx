'use client';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/money';
import { Loader2, Lock, Unlock, Package, MapPin, Phone, Mail, User } from 'lucide-react';

type Order = {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  isReleased: boolean;
  releasedAt: string | null;
  shipCity: string | null;
  shipState: string | null;
  buyer: { name?: string; email?: string; phone?: string } | null;
  shipAddress: { line1: string; line2?: string; city: string; state: string; pincode: string; country: string } | null;
  items: { id: string; productName: string; productImage?: string; quantity: number; price: number; total: number }[];
  subtotalPaise: number;
  courier?: string;
  awbNumber?: string;
};

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'released' | 'pending_release'>('all');

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/seller/orders');
      const j = await r.json();
      setOrders(j.orders || []);
      setLoading(false);
    })();
  }, []);

  const filtered = orders.filter(o => {
    if (filter === 'released') return o.isReleased;
    if (filter === 'pending_release') return !o.isReleased;
    return true;
  });

  const pendingReleaseCount = orders.filter(o => !o.isReleased).length;
  const releasedCount = orders.filter(o => o.isReleased).length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-3xl text-kohl">Orders & Sales</h1>
        <p className="text-mitti text-sm">Items that contain your products</p>
      </div>

      <div className="bg-beige/40 p-4 rounded text-sm text-mitti">
        <p>
          <strong>How buyer info works:</strong> For privacy, full shipping details and contact info are hidden
          until NEEJEE marks the order <span className="font-medium">ready to dispatch</span>. You'll receive an
          email the moment they're released.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase ${
            filter === 'all' ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'
          }`}>All ({orders.length})</button>
        <button onClick={() => setFilter('released')}
          className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase ${
            filter === 'released' ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'
          }`}>Ready to dispatch ({releasedCount})</button>
        <button onClick={() => setFilter('pending_release')}
          className={`px-3 py-1.5 font-ui text-xs tracking-widest uppercase ${
            filter === 'pending_release' ? 'bg-kohl text-ivory' : 'bg-ivory border border-mitti/30 text-mitti'
          }`}>Pending ({pendingReleaseCount})</button>
      </div>

      {loading ? (
        <div className="text-mitti py-20 text-center"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-ivory border border-mitti/20 p-12 text-center text-mitti font-italic italic">
          No orders {filter !== 'all' ? `in this state` : 'yet'}.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(o => (
            <div key={o.orderId} className={`bg-ivory border rounded p-5 ${
              o.isReleased ? 'border-emerald-300' : 'border-mitti/20'
            }`}>
              <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                <div>
                  <p className="font-display text-lg text-kohl">{o.orderNumber}</p>
                  <p className="text-mitti text-xs">
                    {new Date(o.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} ·
                    {' '}{o.shipCity || '—'}, {o.shipState || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tracking-widest px-2 py-0.5 rounded bg-banarasi/20 text-banarasi">
                    {o.status}
                  </span>
                  <span className={`flex items-center gap-1 text-[10px] tracking-widest px-2 py-0.5 rounded ${
                    o.isReleased ? 'bg-emerald-100 text-emerald-800' : 'bg-mitti/10 text-mitti'
                  }`}>
                    {o.isReleased ? <><Unlock className="w-3 h-3" /> RELEASED</> : <><Lock className="w-3 h-3" /> AWAITING RELEASE</>}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1.5">
                {o.items.map(it => (
                  <div key={it.id} className="flex items-center gap-3 text-sm">
                    {it.productImage
                      ? <img src={it.productImage} alt="" className="w-10 h-10 object-cover rounded" />
                      : <div className="w-10 h-10 bg-beige rounded flex items-center justify-center"><Package className="w-4 h-4 text-mitti" /></div>
                    }
                    <div className="flex-1">
                      <p className="text-kohl">{it.productName}</p>
                      <p className="text-mitti text-xs">{it.quantity} × {formatINR(it.price)}</p>
                    </div>
                    <p className="text-kohl tabular-nums">{formatINR(it.total)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-mitti/10 mt-3 pt-3 flex items-center justify-between">
                <p className="text-mitti text-xs">Your subtotal for this order</p>
                <p className="font-display text-lg text-kohl">{formatINR(o.subtotalPaise)}</p>
              </div>

              {/* Buyer info — released or locked */}
              {o.isReleased && o.buyer && o.shipAddress ? (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 p-4 rounded">
                  <p className="label text-emerald-800 mb-2 text-[10px]">SHIPPING INFO — READY TO DISPATCH</p>
                  <div className="space-y-1 text-sm text-kohl">
                    {o.buyer.name && <p className="flex items-center gap-2"><User className="w-3 h-3 text-mitti" /> {o.buyer.name}</p>}
                    {o.buyer.phone && <p className="flex items-center gap-2"><Phone className="w-3 h-3 text-mitti" /> {o.buyer.phone}</p>}
                    {o.buyer.email && <p className="flex items-center gap-2"><Mail className="w-3 h-3 text-mitti" /> {o.buyer.email}</p>}
                    <p className="flex items-start gap-2">
                      <MapPin className="w-3 h-3 text-mitti mt-1" />
                      <span>{o.shipAddress.line1}{o.shipAddress.line2 ? ', ' + o.shipAddress.line2 : ''}<br/>
                      {o.shipAddress.city}, {o.shipAddress.state} {o.shipAddress.pincode}<br/>
                      {o.shipAddress.country}</span>
                    </p>
                  </div>
                  {o.releasedAt && (
                    <p className="text-xs text-mitti italic mt-2">
                      Released {new Date(o.releasedAt).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4 bg-mitti/5 border border-mitti/20 p-4 rounded text-center">
                  <Lock className="w-5 h-5 text-mitti/40 inline mr-2" />
                  <span className="text-mitti text-sm font-italic italic">
                    Buyer name, phone, and full address will appear here once NEEJEE marks this order ready to dispatch.
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
