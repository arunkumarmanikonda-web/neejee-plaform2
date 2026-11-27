import { z } from 'zod';
import { InvoiceStateReviewError } from './gst-state';

export const CHECKOUT_INCLUSIVE = 'CHECKOUT_INCLUSIVE_V1';
const paise = z.number().int().min(0).max(2147483647);
const rate = z.number().finite().min(0).max(100);
const taxClass = z.object({ gstRate: rate, hsnCode: z.string().nullable() });
const itemSchema = taxClass.extend({
  productId: z.string().min(1), variantId: z.string().nullable(), price: paise,
  quantity: z.number().int().positive(), total: paise,
});
const feeSchema = taxClass.extend({ amount: paise });
const snapshotSchema = z.object({
  version: z.literal(1), items: z.array(itemSchema).min(1).max(250),
  shipping: feeSchema, wrap: feeSchema, coupon: paise, points: paise, total: paise,
});
type TaxItem = z.infer<typeof itemSchema>;
type Fee = z.infer<typeof feeSchema>;
export type TaxSnapshot = z.infer<typeof snapshotSchema>;

function review(message: string): never { throw new InvoiceStateReviewError(message); }
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export function includedGst(gross: number, percent: number): number {
  // Rule 35, CGST Rules: inclusive value × rate / (100 + rate).
  return Math.round(gross * percent / (100 + percent));
}

// Largest remainders allocate every paise exactly once, including on mixed-rate orders.
// Keep products in checkout order for deterministic ties. BigInt avoids money overflow.
function distribute(amount: number, weights: number[]): number[] {
  const weightTotal = sum(weights);
  if (!Number.isSafeInteger(weightTotal) || amount > weightTotal) review('Discount exceeds the eligible amount.');
  if (!amount) return weights.map(() => 0);
  const divisor = BigInt(weightTotal);
  const numerators = weights.map(weight => BigInt(weight) * BigInt(amount));
  const shares = numerators.map(value => Number(value / divisor));
  const ranked = numerators.map((value, index) => ({index, remainder:Number(value % divisor)}))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remaining = amount - sum(shares);
  for (let i = 0; i < remaining; i++) shares[ranked[i].index]++;
  return shares;
}

export function checkoutFee(amount: number, items: TaxItem[], kind: 'SHIPPING' | 'GIFT_WRAP', historic = false): Fee {
  if (!amount) return { amount:0, gstRate:0, hsnCode:null };
  const configured = historic ? undefined : process.env['NEEJEE_' + kind + '_GST_RATE'];
  if (configured != null && configured.trim()) {
    if (!/^\d+(\.\d{1,4})?$/.test(configured.trim()) || !rate.safeParse(Number(configured)).success) {
      review('Review the configured delivery or gift-wrap GST rate.');
    }
    return { amount, gstRate:Number(configured), hsnCode:process.env['NEEJEE_' + kind + '_HSN']?.trim() || null };
  }
  const rates = new Set(items.map(item => item.gstRate));
  if (rates.size !== 1) review('Mixed-rate delivery or gift wrap needs its applicable GST rate in finance settings.');
  return { amount, gstRate:items[0].gstRate, hsnCode:null };
}

export function calculateInvoiceAmounts(raw: unknown) {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success) review('The recorded checkout tax information is incomplete.');
  const snapshot = parsed.data;
  const gross = snapshot.items.map(item => {
    if (item.price * item.quantity !== item.total) review('An order line total disagrees with its unit price and quantity.');
    return item.total;
  });
  const subtotal = sum(gross);
  const coupons = distribute(snapshot.coupon, gross);
  const afterCoupon = gross.map((amount, index) => amount - coupons[index]);
  const charges = [
    ...snapshot.items.map((item, index) => ({...item, kind:'product' as const, amount:gross[index], coupon:coupons[index]})),
    { ...snapshot.shipping, kind:'shipping' as const, coupon:0 },
    { ...snapshot.wrap, kind:'wrap' as const, coupon:0 },
  ];
  const points = distribute(snapshot.points, [...afterCoupon, snapshot.shipping.amount, snapshot.wrap.amount]);
  const lines = charges.map((charge, i) => {
    const discount = charge.coupon + points[i];
    const total = charge.amount - discount;
    const tax = includedGst(total, charge.gstRate);
    return { kind:charge.kind, amount:charge.amount, discount, tax, taxable:total-tax, total,
      gstRate:charge.gstRate, hsnCode:charge.hsnCode };
  });
  if (sum(lines.map(line => line.total)) !== snapshot.total) review('Invoice charges do not reconcile to the confirmed order total.');
  return { snapshot, subtotal, lines, tax:sum(lines.map(line => line.tax)) };
}

type OrderForInvoice = {
  checkoutTaxSnapshot?: unknown; source:string; paymentMethod:string | null; paymentStatus:string;
  subtotal:number; shipping:number; discount:number; pointsValue:number; giftWrap:boolean; total:number; tax:number; createdAt:Date;
  items: Array<{productId:string; variantId:string | null; quantity:number; price:number; total:number;
    product:{gstRate:number; hsnCode:string | null; updatedAt:Date}}>;
};

function itemKey(item: {productId:string; variantId:string | null; quantity:number; price:number; total:number}) {
  return JSON.stringify([item.productId,item.variantId,item.quantity,item.price,item.total]);
}

export function reconcileWebsiteOrder(order: OrderForInvoice) {
  const payableCod = order.paymentMethod === 'COD' && order.paymentStatus === 'PENDING';
  if (order.paymentStatus !== 'PAID' && !payableCod) review('Confirm payment before issuing this invoice.');
  let raw = order.checkoutTaxSnapshot;
  if (raw == null) {
    // Unversioned orders only qualify when the unmodified catalogue, actual stored GST and
    // the historical website prices independently reproduce the order to the last paise.
    if (order.source !== 'WEB' || !order.items.length || order.items.some(item => !item.product.updatedAt || item.product.updatedAt > order.createdAt)) {
      review('A historical order needs its original item tax records before posting.');
    }
    const items = order.items.map(({productId, variantId, quantity, price, total, product}) => ({
      productId, variantId, quantity, price, total, gstRate:product.gstRate, hsnCode:product.hsnCode,
    }));
    raw = { version:1, items, shipping:checkoutFee(order.shipping, items, 'SHIPPING', true),
      wrap:checkoutFee(order.giftWrap ? 15000 : 0, items, 'GIFT_WRAP', true),
      coupon:order.discount, points:order.pointsValue, total:order.total };
  }
  const amounts = calculateInvoiceAmounts(raw);
  const snap = amounts.snapshot;
  if (snap.total !== order.total || snap.shipping.amount !== order.shipping || (snap.wrap.amount > 0) !== order.giftWrap ||
      snap.coupon !== order.discount || snap.points !== order.pointsValue || amounts.subtotal !== order.subtotal || amounts.tax !== order.tax ||
      snap.items.length !== order.items.length) review('Order and invoice amounts or recorded GST disagree. Finance review is required.');

  // Relation order is unspecified by the database. Match the priced lines by immutable sale facts.
  const available = new Map<string, number[]>();
  snap.items.forEach((item,index) => {
    const key = itemKey(item);
    const indices = available.get(key) ?? [];
    indices.push(index); available.set(key,indices);
  });
  const products = order.items.map(item => {
    const index = available.get(itemKey(item))?.shift();
    if (index === undefined) review('A recorded invoice line does not match the purchased item.');
    return amounts.lines[index];
  });
  return { products, fees:amounts.lines.slice(snap.items.length).filter(fee => fee.amount > 0), snapshot:snap };
}
