// Only outcomes that positively exclude a completed submission enter the worker.
export const RETRY_NO_CONFIG = 'Not submitted: delivery provider is not configured';
export const RETRY_RATE_LIMIT = 'Not submitted: delivery provider rate-limited the request';
export const RETRY_REASONS = [RETRY_NO_CONFIG, RETRY_RATE_LIMIT];
const eligibleOrderStates: Record<string,string> = {
  ORDER_PLACED:'PLACED', ORDER_CONFIRMED:'CONFIRMED', ORDER_SHIPPED:'SHIPPED',
  ORDER_OUT_FOR_DELIVERY:'OUT_FOR_DELIVERY', ORDER_DELIVERED:'DELIVERED', ORDER_CANCELLED:'CANCELLED',
};
export function currentOrderState(event:string): string | undefined { return eligibleOrderStates[event]; }
export function retryTime(event:string, reason:string | undefined, attempt:number, maxAttempts:number, now:number, retryAfterMs = 0) {
  if (!currentOrderState(event) || !reason || !RETRY_REASONS.includes(reason) || attempt >= maxAttempts) return null;
  const backoff = reason === RETRY_NO_CONFIG ? 60 * 60_000 : 5 ** attempt * 60_000;
  return new Date(now + Math.max(backoff, retryAfterMs));
}
export function retryAfterMs(header:string | null, now = Date.now()): number {
  if (!header) return 0;
  const seconds = Number(header);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
  return Number.isFinite(delay) ? Math.max(0,Math.min(delay,7*86_400_000)) : 0;
}
