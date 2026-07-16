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
    default: return null;
  }
}

export interface ResolvedTemplate {
  event: SmsEvent;
  templateId: string; // Fast2SMS message ID (example: 218985), not entity ID
  body: string;
  varOrder: string[];
  active: boolean;
  ready: boolean;
  providerApproved: boolean;
  providerSenderId: string | null;
  providerEntityId: string | null;
  invalidReason: 'missing_template_id' | 'entity_id_used' | 'not_in_provider_catalog' | null;
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; map: Map<SmsEvent, ResolvedTemplate> } | null = null;

function normalizeId(value: unknown): string {
  return String(value ?? '').trim();
}

async function loadTemplateMap(): Promise<Map<SmsEvent, ResolvedTemplate>> {
  const [rows, providerRows] = await Promise.all([
    prisma.smsTemplate.findMany(),
    prisma.fast2SmsProviderTemplate.findMany({
      select: {
        messageId: true,
        senderId: true,
        entityId: true,
        status: true,
      },
    }),
  ]);

  const approvedByMessageId = new Map(
    providerRows
      .filter((r) => !r.status || /approved/i.test(String(r.status)))
      .map((r) => [normalizeId(r.messageId), r] as const)
      .filter(([messageId]) => !!messageId)
  );

  const knownEntityIds = new Set(
    providerRows
      .map((r) => normalizeId(r.entityId))
      .filter(Boolean)
  );

  const map = new Map<SmsEvent, ResolvedTemplate>();

  for (const r of rows) {
    const normalizedTemplateId = normalizeId(r.templateId);
    const providerMatch = approvedByMessageId.get(normalizedTemplateId);

    const invalidReason =
      !normalizedTemplateId
        ? 'missing_template_id'
        : providerMatch
        ? null
        : knownEntityIds.has(normalizedTemplateId)
        ? 'entity_id_used'
        : 'not_in_provider_catalog';

    map.set(r.event as SmsEvent, {
      event: r.event as SmsEvent,
      templateId: normalizedTemplateId,
      body: r.body,
      varOrder: Array.isArray(r.varOrder) ? r.varOrder : [],
      active: r.active,
      ready: r.active && !!providerMatch,
      providerApproved: !!providerMatch,
      providerSenderId: providerMatch?.senderId ?? null,
      providerEntityId: providerMatch?.entityId ?? null,
      invalidReason,
    });
  }

  return map;
}

export async function getTemplate(event: SmsEvent): Promise<ResolvedTemplate | null> {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_TTL_MS) {
    cache = { at: now, map: await loadTemplateMap() };
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
    .map((key) => {
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
  } catch {
    /* non-fatal */
  }
}