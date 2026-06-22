// v23.35 — DB-backed DLT template registry
// Reads templates from SmsTemplate table so IDs can be updated via /admin/settings/sms
// without redeploying.

import { prisma } from '@/lib/prisma';

export type SmsEvent =
  | 'otp_login'
  | 'order_placed'
  | 'payment_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'refund_initiated'
  | 'abandoned_cart'
  | 'seller_payout'
  | 'vendor_payout';

/**
 * Map NotificationEvent (UPPER_CASE) -> SmsEvent (lower_case).
 * Notification events not in this map will not trigger SMS (gracefully skipped).
 */
export function mapNotificationToSmsEvent(event: string): SmsEvent | null {
  switch (event) {
    case 'ORDER_PLACED':       return 'order_placed';
    case 'ORDER_CONFIRMED':    return 'payment_confirmed';
    case 'ORDER_SHIPPED':      return 'order_shipped';
    case 'ORDER_DELIVERED':    return 'order_delivered';
    case 'ORDER_CANCELLED':    return 'order_cancelled';
    case 'ORDER_REFUNDED':     return 'refund_initiated';
    case 'SELLER_PAYOUT_PAID': return 'seller_payout';
    case 'PAYOUT_PAID':        return 'vendor_payout';
    case 'ABANDONED_CART':     return 'abandoned_cart';
    case 'OTP_LOGIN':          return 'otp_login';
    // Any other event = no SMS
    default: return null;
  }
}

export interface ResolvedTemplate {
  event: SmsEvent;
  templateId: string;        // 19-digit DLT message_id
  body: string;
  varOrder: string[];
  active: boolean;
  ready: boolean;            // true only if templateId != PASTE_DLT_ID and active
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; map: Map<SmsEvent, ResolvedTemplate> } | null = null;

export async function getTemplate(event: SmsEvent): Promise<ResolvedTemplate | null> {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_TTL_MS) {
    const rows = await prisma.smsTemplate.findMany();
    const map = new Map<SmsEvent, ResolvedTemplate>();
    for (const r of rows) {
      map.set(r.event as SmsEvent, {
        event: r.event as SmsEvent,
        templateId: r.templateId,
        body: r.body,
        varOrder: r.varOrder,
        active: r.active,
        ready: r.active && r.templateId !== 'PASTE_DLT_ID' && /^\d{6,25}$/.test(r.templateId),
      });
    }
    cache = { at: now, map };
  }
  return cache.map.get(event) || null;
}

export function invalidateTemplateCache() {
  cache = null;
}

/**
 * Build the variables array in the order the DLT template expects.
 * Fast2SMS expects pipe-separated values matching {#var#} order.
 */
export function buildVarValues(tpl: ResolvedTemplate, vars: Record<string, string | number>): string {
  return tpl.varOrder
    .map(key => {
      const v = vars[key];
      return v === undefined || v === null ? '' : String(v);
    })
    .join('|');
}

/**
 * Render the body locally (for previews / non-DLT fallback).
 */
export function renderBody(tpl: ResolvedTemplate, vars: Record<string, string | number>): string {
  let out = tpl.body;
  for (const key of tpl.varOrder) {
    out = out.replace('{#var#}', String(vars[key] ?? ''));
  }
  return out;
}

export async function markUsed(event: SmsEvent) {
  try {
    await prisma.smsTemplate.update({
      where: { event },
      data: { lastUsedAt: new Date() },
    });
    invalidateTemplateCache();
  } catch { /* non-fatal */ }
}
