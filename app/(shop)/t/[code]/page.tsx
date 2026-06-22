// v26.3f — Short URL alias for shipment AWB tracking (used in SMS bodies).
// /t/<code> → external Shiprocket tracking URL (if known)
//          → fallback: /orders/<orderNumber> by looking up the AWB
//          → ultimate fallback: /help/track (manual tracking entry)
// Whitelisted as static CTA prefix `neejee.com/t` on Jio DLT.
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function ShipmentShortRedirect({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code);

  try {
    // Find order by awbNumber. If trackingUrl is set, send user to courier site.
    const order = await prisma.order.findFirst({
      where: { awbNumber: code },
      select: { orderNumber: true, trackingUrl: true },
    });

    if (order?.trackingUrl) {
      redirect(order.trackingUrl);
    }
    if (order?.orderNumber) {
      redirect(`/orders/${encodeURIComponent(order.orderNumber)}`);
    }
  } catch {
    // Silent fall-through to manual track help page
  }

  redirect('/help/track');
}