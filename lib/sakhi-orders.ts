import type { PitariReply } from './pitari';
import { formatINR } from './money';

const tracking = { label: 'Track a guest order', href: '/help/track' };
const orders = { label: 'View my orders', href: '/account?tab=orders' };
const orderPattern = /\bNEE-[A-Z\d-]+\b/i;
const pretty = (value: string) => (value === 'CANCELLED_BUG' ? 'cancelled' : value.toLowerCase().replaceAll('_', ' '));

export function orderQuestion(question: string, prior?: unknown) {
  const explicit = question.match(orderPattern)?.[0].toUpperCase();
  const personal = /(?<![\p{L}\p{N}])(?:my|our|mera|meri|mere|मेरा|मेरे|मेरी)\s+(?:(?:last|latest|recent|previous|most recent)\s+)?(?:orders?|parcels?|packages?|deliver(?:y|ies)|shipment|payment|refund|return|purchase|ऑर्डर|रिफंड)|(?:track|locate|status of) (?:an? |the )?(?:order|parcel)|order (?:status|kaha|kab)|where(?:'s| is) (?:the |my )?(?:order|parcel)|ऑर्डर.*(?:कब|कहाँ)/iu.test(question);
  const saved = typeof prior === 'string' && /^NEE-[A-Z\d-]{1,48}$/i.test(prior) ? prior.toUpperCase() : undefined;
  const following = saved && /\b(it|that order|this order|paid|payment|delivered|shipped|courier|refund|tracking|cancel|return|when will it arrive)\b/i.test(question) && !/policy|usually|generally/i.test(question);
  if (!explicit && !personal && !following) return null;
  return { number: explicit || (/latest|most recent|last order|all (?:my )?orders|my orders/i.test(question) ? undefined : saved), returns: /return|refund|रिफंड/i.test(question) };
}

type Summary = {
  orderNumber: string; status: string; paymentStatus: string; total: number;
  createdAt: Date; shippedAt: Date | null; deliveredAt: Date | null;
  courier: string | null; awbNumber: string | null;
  items: { quantity: number; product: { name: string } }[];
  disputes: { status: string }[];
};
type Lookup = (userId: string, number?: string) => Promise<Summary[]>;
export async function answerOrder(userId: string | undefined, intent: NonNullable<ReturnType<typeof orderQuestion>>, lookup: Lookup): Promise<PitariReply> {
  if (!userId) return { text: 'Sign in and I can check your latest order, payment or return. If you checked out as a guest, use your order number and checkout email in guest tracking.', links: [{label:'Sign in to my account',href:'/login?next=%2Faccount%3Ftab%3Dorders'},tracking] };
  const rows = await lookup(userId, intent.number);
  if (!rows.length) return {text:intent.number ? 'I couldn’t find that order in this account. Check the number on your confirmation, or use guest tracking if you checked out as a guest.' : 'I couldn’t find an order in this account yet. If you checked out as a guest, you can still track it.',links:[orders,tracking]};
  const order = rows[0];
  const date = (value: Date) => value.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'});
  const detail = (number: string) => ({label:'View '+number,href:'/orders/'+encodeURIComponent(number)});
  const lines = [order.orderNumber+' · '+date(order.createdAt),order.items.map(i=>i.quantity+' × '+i.product.name).join(', '),'Order '+pretty(order.status)+'. Payment '+pretty(order.paymentStatus)+'. Total '+formatINR(order.total)+'.'];
  if (order.deliveredAt) lines.push('Delivered on '+date(order.deliveredAt)+'.');
  else if (order.shippedAt) lines.push('Shipped on '+date(order.shippedAt)+'.');
  if (order.courier || order.awbNumber) lines.push([order.courier,order.awbNumber && 'Tracking number '+order.awbNumber].filter(Boolean).join(' · '));
  if (intent.returns) lines.push(order.disputes.length ? 'Return request status: '+order.disputes.map(d=>pretty(d.status)).join(', ')+'.' : 'There is no return request recorded for this order. Open the order to see the options for each item.');
  if (rows.length > 1) lines.push('I’ve shown your most recent order. You can open an earlier one below.');
  return {text:lines.filter(Boolean).join('\n'),links:rows.map(r=>detail(r.orderNumber)),order:order.orderNumber};
}
