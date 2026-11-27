// v26.3f — Short URL alias for order tracking (used in SMS bodies).
// /o/<orderNumber> → /orders/<orderNumber>
// Whitelisted as static CTA prefix `neejee.com/o` on Jio DLT.
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OrderShortRedirect(props: { params: Promise<{ orderNumber: string }> }) {
  const params = await props.params;
  redirect(`/orders/${encodeURIComponent(params.orderNumber)}`);
}