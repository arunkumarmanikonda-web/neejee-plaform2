import { createHmac, timingSafeEqual } from 'node:crypto';

export const RETURN_COOKIE = 'neejee-return-access';
export const RETURN_ACCESS_SECONDS = 20 * 60;

function signature(orderId: string, expiry: number) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
  if (secret.length < 32) throw new Error('Return access secret is missing');
  return createHmac('sha256', secret).update(`neejee:return:v1:${orderId}:${expiry}`).digest('hex');
}

export function issueReturnAccess(orderId: string, now = Date.now()) {
  const expiry = Math.floor(now / 1000) + RETURN_ACCESS_SECONDS;
  return `${expiry}.${signature(orderId, expiry)}`;
}

export function canReadReturnOrder(
  order: { id: string; userId: string | null }, userId?: string, token?: string, now = Date.now(),
) {
  if (order.userId !== null) return order.userId === userId;
  const match = /^(\d{1,12})\.([a-f0-9]{64})$/.exec(token || '');
  if (!match) return false;
  const expiry = Number(match[1]);
  const current = Math.floor(now / 1000);
  if (expiry <= current || expiry > current + RETURN_ACCESS_SECONDS) return false;
  return timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(signature(order.id, expiry), 'hex'));
}
