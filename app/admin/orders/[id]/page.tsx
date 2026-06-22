'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

const STATUSES = ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

function ReleaseToSellersButton({ orderId, order, onDone }: { orderId: string; order: any; onDone: () => void }) {
  // Only show when the order has items from marketplace sellers.
  const sellerIds = Array.from(new Set((order?.items || []).map((i: any) => i.product?.sellerId).filter(Boolean)));
  if (sellerIds.length === 0) return null;
  const release = async () => {
    if (!confirm(`Release buyer name, phone, and full address to ${sellerIds.length} seller(s)? This cannot be reversed.`)) return;
    const r = await fetch(`/api/admin/orders/${orderId}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const j = await r.json();
    if (!r.ok) { alert('Error: ' + j.error); return; }
    alert(j.message || 'Released');
    onDone();
  };
  return (
    <button onClick={release}
      className="border border-banarasi text-banarasi px-4 py-2 font-ui text-xs tracking-widest">
      RELEASE TO SELLERS
    </button>
  );
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id as string;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [tracking, setTracking] = useState({ awbNumber: '', courier: '', trackingUrl: '' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setOrder(data.order);
      setTracking({
        awbNumber: data.order.awbNumber || '',
        courier: data.order.courier || '',
        trackingUrl: data.order.trackingUrl || '',
      });
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (orderId) load(); }, [orderId]);

  const updateStatus = async (newStatus: string) => {
    if (!confirm(`Change status to ${newStatus}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e: any) { alert('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const saveTracking = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tracking),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Tracking saved');
      await load();
    } catch (e: any) { alert('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="text-mitti">Loading order...</p>;
  if (error) return <p className="text-madder bg-madder/10 p-4">{error}</p>;
  if (!order) return <p className="text-mitti">Order not found.</p>;

  return (
    <>
      <Link href="/admin/orders" className="label text-mitti hover:text-madder">← BACK TO ORDERS</Link>
      <div className="flex justify-between items-start mt-2">
        <div>
          <h1 className="font-display text-3xl text-kohl">{order.orderNumber}</h1>
          <p className="font-italic italic text-mitti mt-1">Placed on {new Date(order.createdAt).toLocaleString('en-IN')}</p>
        </div>
        <div className="flex gap-3">
          <ReleaseToSellersButton orderId={orderId} order={order} onDone={load} />
          <button onClick={() => window.print()} className="btn-outline">PRINT INVOICE</button>
        </div>
      </div>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-3 gap-6 mt-8">
        <div className="bg-beige p-6">
          <p className="label text-madder">STATUS</p>
          <p className="font-display text-2xl mt-2">{order.status.replace(/_/g, ' ')}</p>
          <select
            value={order.status}
            onChange={e => updateStatus(e.target.value)}
            disabled={saving}
            className="mt-3 w-full bg-ivory border border-mitti/20 p-2 font-ui text-xs">
            {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="bg-beige p-6">
          <p className="label text-madder">PAYMENT</p>
          <p className={`font-display text-2xl mt-2 ${order.paymentStatus === 'PAID' ? 'text-neem' : 'text-haldi'}`}>
            {order.paymentStatus}
          </p>
          <p className="font-ui text-xs text-monsoon mt-3">{order.paymentMethod || '—'}</p>
          {order.razorpayPaymentId && <p className="font-ui text-[10px] text-monsoon mt-1 truncate">{order.razorpayPaymentId}</p>}
        </div>
        <div className="bg-beige p-6">
          <p className="label text-madder">TOTAL</p>
          <p className="font-display text-2xl mt-2">{formatPrice(order.total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="col-span-2 bg-beige p-8">
          <p className="label text-madder mb-4">ITEMS ({order.items.length})</p>
          <table className="w-full font-ui text-sm">
            <thead><tr className="border-b border-mitti/20 text-xs text-mitti">
              <th className="text-left py-2">PRODUCT</th><th>QTY</th><th>PRICE</th><th>TOTAL</th>
            </tr></thead>
            <tbody>
              {order.items.map((i: any) => (
                <tr key={i.id} className="border-b border-mitti/10">
                  <td className="py-3">
                    <p className="font-display text-base">{i.product?.name || 'Product'}</p>
                    <p className="text-xs text-mitti">{i.product?.sku} {i.variant ? `· ${i.variant.size || ''} ${i.variant.color || ''}` : ''}</p>
                  </td>
                  <td className="text-center">{i.quantity}</td>
                  <td className="text-center">{formatPrice(i.price)}</td>
                  <td className="text-center font-medium">{formatPrice(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 space-y-1 text-sm text-right font-ui">
            <p>Subtotal: <span className="font-medium ml-2">{formatPrice(order.subtotal)}</span></p>
            <p>Shipping: <span className="font-medium ml-2">{order.shipping > 0 ? formatPrice(order.shipping) : 'FREE'}</span></p>
            {order.discount > 0 && <p className="text-neem">Discount: <span className="font-medium ml-2">-{formatPrice(order.discount)}</span></p>}
            <p className="text-xs text-monsoon">GST: <span className="ml-2">{formatPrice(order.tax)}</span></p>
            <p className="font-display text-xl mt-2 text-kohl">Total: <span className="ml-2">{formatPrice(order.total)}</span></p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">CUSTOMER</p>
            <p className="font-display text-lg">{order.user?.name || order.guestName || 'Guest'}</p>
            <p className="text-sm text-monsoon mt-1">{order.user?.email || order.guestEmail}</p>
            {order.user?.phone && <p className="text-sm text-monsoon">{order.user.phone}</p>}
          </div>
          {order.address && (
            <div className="bg-beige p-6">
              <p className="label text-madder mb-3">SHIP TO</p>
              <p className="font-body text-sm text-kohl/85">
                {order.address.line1}<br />
                {order.address.line2 && <>{order.address.line2}<br /></>}
                {order.address.city}, {order.address.state}<br />
                {order.address.pincode}, India
              </p>
            </div>
          )}
          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">TRACKING</p>
            <input value={tracking.courier} onChange={e => setTracking({...tracking, courier: e.target.value})}
              placeholder="Courier (e.g. Delhivery)" className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-xs mt-2" />
            <input value={tracking.awbNumber} onChange={e => setTracking({...tracking, awbNumber: e.target.value})}
              placeholder="AWB Number" className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-xs mt-2" />
            <input value={tracking.trackingUrl} onChange={e => setTracking({...tracking, trackingUrl: e.target.value})}
              placeholder="Tracking URL" className="w-full p-2 bg-ivory border border-mitti/20 font-ui text-xs mt-2" />
            <button onClick={saveTracking} disabled={saving} className="btn-primary text-xs mt-3 w-full disabled:opacity-50">
              {saving ? 'SAVING...' : 'SAVE TRACKING'}
            </button>
            <button
              onClick={async () => {
                setSaving(true);
                const res = await fetch(`/api/admin/orders/${order.orderNumber}/shiprocket`, { method: 'POST' });
                const j = await res.json();
                if (res.ok && j.awb?.ok) {
                  alert(`Shiprocket shipment created.\nAWB: ${j.awb.awb}\nCourier: ${j.awb.courier}`);
                  location.reload();
                } else {
                  alert(j.error || 'Shiprocket failed. Check env vars.');
                }
                setSaving(false);
              }}
              disabled={saving}
              className="text-xs mt-2 w-full py-2 border border-madder text-madder hover:bg-madder hover:text-ivory disabled:opacity-50 tracking-wider"
            >
              CREATE SHIPROCKET SHIPMENT
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
