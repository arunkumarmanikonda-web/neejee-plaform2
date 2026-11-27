import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
export function codAttemptKey(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return null;
  return sha256('neejee:cod:v1:' + value.toLowerCase());
}

export function codRequestHash(body: any, userId?: string) {
  const items = (Array.isArray(body.items) ? body.items : []).map((item: any) =>
    [text(item?.productId), text(item?.variantId), Number(item?.quantity)]).sort((a: unknown[], b: unknown[]) =>
      JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const address = body.address || {};
  return sha256(JSON.stringify([
    userId || null, text(body.contact?.email).toLowerCase(), text(body.contact?.phone), items,
    ...['name', 'line1', 'line2', 'city', 'state', 'pincode', 'country'].map(field => text(address[field])),
    body.shipping || 'STANDARD', !!body.giftWrap, text(body.personalNote), text(body.couponCode).toUpperCase(),
    text(body.gstinCustomer).toUpperCase(), Number(body.pointsToRedeem) || 0, body.expectedTotal ?? null,
  ]));
}

export const confirmedCodOrder = (order: { id: string; orderNumber: string; total: number }) => ({
  success: true, orderNumber: order.orderNumber, orderId: order.id, total: order.total, paymentMethod: 'COD', next: 'confirmation',
});

export function findCodAttempt(key: string) {
  return prisma.order.findUnique({
    where: { codAttemptKey: key },
    select: { id: true, orderNumber: true, total: true, userId: true, codRequestHash: true },
  });
}
