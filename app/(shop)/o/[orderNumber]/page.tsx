// v26.3f — Short URL alias for order tracking (used in SMS bodies).
// /o/<orderNumber> → /orders/<orderNumber>
// Whitelisted as static CTA prefix `neejee.com/o` on Jio DLT.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default function OrderShortRedirect({ params }: { params: { orderNumber: string } }) {
  redirect(`/orders/${encodeURIComponent(params.orderNumber)}`);
}