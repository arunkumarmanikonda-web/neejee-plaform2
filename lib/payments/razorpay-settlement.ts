import { razorpayCredentials } from './razorpay-credentials';
type GatewayPayment = {
  id?:string; order_id?:string; status?:string; captured?:boolean; amount?:number; currency?:string; amount_refunded?:number;
};
type GatewayRefund = {id?:string; payment_id?:string; currency?:string; status?:string; amount?:number};
export type CaptureState = 'captured' | 'pending' | 'refunded' | 'failed' | 'mismatch';

export function captureState(payment:GatewayPayment, paymentId:string, orderId:string, total:number):CaptureState {
  if (!Number.isSafeInteger(total) || total <= 0 || payment.id !== paymentId || payment.order_id !== orderId ||
      payment.currency !== 'INR' || payment.amount !== total) return 'mismatch';
  if (payment.status === 'refunded' || (payment.amount_refunded || 0) > 0) return 'refunded';
  if (payment.status === 'failed') return 'failed';
  return payment.status === 'captured' && payment.captured === true ? 'captured' : 'pending';
}

async function gatewayGet<T>(path:string):Promise<T> {
  const { keyId: key, keySecret: secret } = razorpayCredentials();
  if (!key || !secret) throw new Error('Payment service unavailable');
  const res = await fetch('https://api.razorpay.com/v1/'+path,{
    headers:{Authorization:'Basic '+Buffer.from(key+':'+secret).toString('base64')},
    cache:'no-store',signal:AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error('Payment service returned '+res.status);
  return await res.json() as T;
}

export function fetchGatewayPayment(paymentId:string) {
  return gatewayGet<GatewayPayment>('payments/'+encodeURIComponent(paymentId));
}

export function processedRefundTotal(refunds:Iterable<GatewayRefund>, paymentId:string):number {
  const amounts=new Map<string,number>();
  for (const item of refunds) {
    if (item.status !== 'processed' || item.payment_id !== paymentId) continue;
    if (!item.id || item.currency !== 'INR' || !Number.isSafeInteger(item.amount) || (item.amount || 0)<=0) throw new Error('Invalid processed refund');
    if (amounts.has(item.id) && amounts.get(item.id) !== item.amount) throw new Error('Conflicting processed refund');
    amounts.set(item.id,item.amount!);
  }
  return [...amounts.values()].reduce((a,b) => a+b,0);
}

export async function fetchRefundedPaise(paymentId:string, event:GatewayRefund) {
  const all:GatewayRefund[] = [event];
  for (let skip=0;;skip+=100) {
    const page=await gatewayGet<{items:GatewayRefund[]}>('payments/'+encodeURIComponent(paymentId)+'/refunds?count=100&skip='+skip);
    if (!Array.isArray(page.items)) throw new Error('Incomplete refund list');
    all.push(...page.items);
    if (page.items.length < 100) return processedRefundTotal(all,paymentId);
  }
}
