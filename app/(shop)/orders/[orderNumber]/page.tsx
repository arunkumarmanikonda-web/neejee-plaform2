// v26.3f — Customer-facing order details page.
// Reached via /o/<orderNumber> short URL from SMS, or directly.
// Requires authenticated session (customer's own order).
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata = {
  title: 'Order details · NEEJEE',
};

const fmtINR = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const fmtDate = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default async function OrderDetailsPage({
  params,
}: {
  params: { orderNumber: string };
}) {
  const session = await getSession();
  if (!session) {
    redirect(`/login?next=/orders/${encodeURIComponent(params.orderNumber)}`);
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: decodeURIComponent(params.orderNumber) },
    include: {
      items: { include: { product: { select: { name: true, slug: true, images: true } } } },
    },
  });

  if (!order) notFound();

  // Only the buyer may view their order (or admin/staff via separate admin route).
  const isOwner = order.userId === session.id || order.guestEmail === session.email;
  const isStaff = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'].includes(session.role);
  if (!isOwner && !isStaff) {
    notFound();
  }

  const statusLabel: Record<string, string> = {
    PLACED: 'Order placed',
    CONFIRMED: 'Confirmed',
    PACKED: 'Packed',
    SHIPPED: 'Shipped',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    RETURNED: 'Returned',
    REFUNDED: 'Refunded',
    CANCELLED_BUG: 'Cancelled',
  };

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <p className="label text-madder mb-3">ORDER</p>
        <h1 className="font-display text-4xl text-kohl">{order.orderNumber}</h1>
        <p className="font-body text-mitti italic mt-2">
          Placed {fmtDate(order.createdAt)} · {statusLabel[order.status] || order.status}
        </p>

        <div className="madder-divider mt-8 mb-10" />

        <section className="space-y-4">
          {order.items.map((item: any) => (
            <div key={item.id} className="flex gap-4 py-4 border-b border-mitti/15">
              {item.product?.images?.[0] && (
                <img
                  src={item.product.images[0]}
                  alt={item.product.name}
                  className="w-20 h-20 object-cover bg-beige"
                />
              )}
              <div className="flex-1">
                <p className="font-display text-lg text-kohl">{item.product?.name || item.productName}</p>
                <p className="font-body text-sm text-mitti">Qty {item.quantity}</p>
              </div>
              <p className="font-body text-kohl">{fmtINR(item.price * item.quantity)}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 space-y-2 font-body text-sm">
          <div className="flex justify-between text-mitti">
            <span>Subtotal</span><span>{fmtINR(order.subtotal)}</span>
          </div>
          {order.shipping > 0 && (
            <div className="flex justify-between text-mitti">
              <span>Shipping</span><span>{fmtINR(order.shipping)}</span>
            </div>
          )}
          {order.discount > 0 && (
            <div className="flex justify-between text-madder">
              <span>Discount</span><span>−{fmtINR(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-display text-lg text-kohl pt-3 border-t border-mitti/20">
            <span>Total</span><span>{fmtINR(order.total)}</span>
          </div>
        </section>

        {(order.status === 'SHIPPED' || order.status === 'OUT_FOR_DELIVERY') && order.trackingUrl && (
          <section className="mt-10 p-6 bg-beige text-center">
            <p className="label text-madder mb-3">SHIPMENT</p>
            <p className="font-body text-kohl mb-4">
              AWB {order.awbNumber} via {order.courier || 'courier partner'}
            </p>
            <a href={order.trackingUrl} target="_blank" rel="noopener" className="btn-primary inline-block">
              Track shipment
            </a>
          </section>
        )}

        <div className="mt-12 text-center">
          <Link href="/help/contact" className="font-body text-sm text-mitti underline">
            Need help with this order?
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}