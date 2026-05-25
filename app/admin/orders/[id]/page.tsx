import Link from 'next/link';
import { formatPrice } from '@/lib/utils';

export default function AdminOrderDetail({ params }: { params: { id: string } }) {
  const order = {
    id: params.id,
    customer: { name: 'Priya R.', email: 'priya@example.com', phone: '+91 98765 43210' },
    address: { line1: 'A-12, Sea View Apts, Worli', city: 'Mumbai', state: 'Maharashtra', pincode: '400018' },
    items: [
      { name: 'Banarasi Pure Silk Saree', sku: 'NEE-SAR-001', qty: 1, price: 2450000 },
    ],
    subtotal: 2450000, shipping: 0, tax: 122500, total: 2450000,
    status: 'PACKED', payment: 'PAID', placedAt: '2026-05-20T08:14:00Z',
  };

  return (
    <>
      <Link href="/admin/orders" className="label text-mitti hover:text-madder">← BACK TO ORDERS</Link>
      <div className="flex justify-between items-start mt-2">
        <div>
          <h1 className="font-display text-3xl text-kohl">{order.id}</h1>
          <p className="font-italic italic text-mitti mt-1">Placed on {new Date(order.placedAt).toLocaleString('en-IN')}</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-outline">PRINT INVOICE</button>
          <button className="btn-primary">UPDATE STATUS</button>
        </div>
      </div>
      <div className="madder-divider mt-4"></div>

      <div className="grid grid-cols-3 gap-6 mt-8">
        <div className="bg-beige p-6">
          <p className="label text-madder">STATUS</p>
          <p className="font-display text-2xl mt-2">{order.status}</p>
        </div>
        <div className="bg-beige p-6">
          <p className="label text-madder">PAYMENT</p>
          <p className="font-display text-2xl mt-2 text-neem">{order.payment}</p>
        </div>
        <div className="bg-beige p-6">
          <p className="label text-madder">TOTAL</p>
          <p className="font-display text-2xl mt-2">{formatPrice(order.total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mt-6">
        <div className="col-span-2 bg-beige p-8">
          <p className="label text-madder mb-4">ITEMS</p>
          <table className="w-full font-ui text-sm">
            <thead><tr className="border-b border-mitti/20 text-xs text-mitti">
              <th className="text-left py-2">PRODUCT</th><th>QTY</th><th>PRICE</th><th>TOTAL</th>
            </tr></thead>
            <tbody>
              {order.items.map((i, idx) => (
                <tr key={idx} className="border-b border-mitti/10">
                  <td className="py-3">
                    <p className="font-display text-base">{i.name}</p>
                    <p className="text-xs text-mitti">{i.sku}</p>
                  </td>
                  <td className="text-center">{i.qty}</td>
                  <td className="text-center">{formatPrice(i.price)}</td>
                  <td className="text-center font-medium">{formatPrice(i.price * i.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 space-y-1 text-sm text-right font-ui">
            <p>Subtotal: <span className="font-medium ml-2">{formatPrice(order.subtotal)}</span></p>
            <p>Shipping: <span className="font-medium ml-2">FREE</span></p>
            <p className="text-xs text-monsoon">Inclusive of GST: <span className="ml-2">{formatPrice(order.tax)}</span></p>
            <p className="font-display text-xl mt-2 text-kohl">Total: <span className="ml-2">{formatPrice(order.total)}</span></p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">CUSTOMER</p>
            <p className="font-display text-lg">{order.customer.name}</p>
            <p className="text-sm text-monsoon mt-1">{order.customer.email}</p>
            <p className="text-sm text-monsoon">{order.customer.phone}</p>
          </div>
          <div className="bg-beige p-6">
            <p className="label text-madder mb-3">SHIP TO</p>
            <p className="font-body text-sm text-kohl/85">
              {order.address.line1}<br />
              {order.address.city}, {order.address.state}<br />
              {order.address.pincode}, India
            </p>
            <button className="mt-4 font-ui text-xs tracking-widest text-madder hover:underline">CREATE SHIPROCKET PICKUP →</button>
          </div>
        </div>
      </div>
    </>
  );
}
