// lib/notifications/channels/aisensy.ts
// v26.3b — AiSensy WhatsApp adapter.
//
// AiSensy "Campaign API" docs:
//   POST https://backend.aisensy.com/campaign/t1/api/v2
// Body shape (JSON):
//   {
//     apiKey, campaignName, destination, userName, source,
//     templateParams: [...positional variables for {{1}}, {{2}}, ...],
//     media: { url, filename } (optional),
//     buttons: [...] (only if template has dynamic buttons),
//     paramsFallbackValue: { ... }
//   }
//
// "campaignName" must be the template_name we registered with AiSensy.

import type { ChannelAdapter, ChannelSendResult, DispatchRecord, NotificationEvent } from '../types';

const TEMPLATE_NAME_MAP: Partial<Record<NotificationEvent, string | null>> = {
  // Recovery
  CART_T1H:                null,  // no WA at T+1h
  CART_T24H:               'recovery_karigar_gift',
  CART_T72H:               'recovery_farewell_gift',
  TELECALLER_HANDOFF:      null,  // internal only
  // Auth
  OTP_LOGIN:               null,  // SMS-only per locked decision
  OTP_SIGNUP:              null,
  // Order lifecycle
  ORDER_PLACED:            'order_placed',
  ORDER_SHIPPED:           'order_shipped',
  ORDER_OUT_FOR_DELIVERY:  'out_for_delivery',
  ORDER_DELIVERED:         'order_delivered',
  ORDER_CANCELLED:         'order_cancelled',
};

// Positional variable order per event — matches the {{1}}, {{2}}, {{3}} slots
// in the WhatsApp template body registered with AiSensy/Meta.
const VAR_ORDER: Partial<Record<NotificationEvent, string[]>> = {
  CART_T1H:                [],
  CART_T24H:               ['firstName', 'craftRegion', 'discountPct', 'code', 'cartId'],
  CART_T72H:               ['firstName', 'craftRegion', 'discountPct', 'code', 'cartId'],
  TELECALLER_HANDOFF:      [],
  OTP_LOGIN:               [],
  OTP_SIGNUP:              [],
  ORDER_PLACED:            ['firstName', 'orderNumber', 'itemsSummary', 'totalRupees', 'paymentMethod', 'orderNumber'],
  ORDER_SHIPPED:           ['firstName', 'orderNumber', 'courier', 'awbNumber', 'expectedDelivery', 'awbNumber'],
  ORDER_OUT_FOR_DELIVERY:  ['firstName', 'orderNumber', 'awbNumber'],
  ORDER_DELIVERED:         ['firstName', 'orderNumber', 'orderNumber'],
  ORDER_CANCELLED:         ['firstName', 'orderNumber', 'refundRupees', 'refundMethod', 'refundEta', 'orderNumber'],
};

function normalizePhone(p: string): string {
  // AiSensy expects "919876543210" — country code + 10 digits, no + or dashes
  const digits = p.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  return digits;
}

export const aisensyAdapter: ChannelAdapter = {
  name: 'aisensy',
  channel: 'WHATSAPP',

  isConfigured() {
    return !!process.env.AISENSY_API_KEY;
  },

  async send(d: DispatchRecord): Promise<ChannelSendResult> {
    const apiKey = process.env.AISENSY_API_KEY;
    const apiUrl = process.env.AISENSY_API_URL || 'https://backend.aisensy.com/campaign/t1/api/v2';

    if (!apiKey) {
      return { ok: false, errorMessage: 'AISENSY_API_KEY not set', permanentFailure: false };
    }

    const templateName = TEMPLATE_NAME_MAP[d.event];
    if (!templateName) {
      return {
        ok: false,
        errorMessage: `No WhatsApp template configured for event ${d.event}`,
        permanentFailure: true,
      };
    }

    // Build positional template params
    const order = VAR_ORDER[d.event] || [];
    const templateParams: string[] = [];
    for (const key of order) {
      const v = d.variables![key];
      if (v === undefined || v === null) {
        return {
          ok: false,
          errorMessage: `Missing required variable: ${key} for event ${d.event}`,
          permanentFailure: true,
        };
      }
      templateParams.push(String(v));
    }

    const destination = normalizePhone(d.recipient);
    if (!destination || destination.length < 10) {
      return { ok: false, errorMessage: `Invalid phone: ${d.recipient}`, permanentFailure: true };
    }

    const body: any = {
      apiKey,
      campaignName: templateName,
      destination,
      userName: d.variables!.firstName || 'Customer',
      source: 'neejee-platform',
      templateParams,
    };

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false || data?.status === 'error') {
        return {
          ok: false,
          providerResponse: data,
          errorMessage: data?.message || data?.error || `HTTP ${res.status}`,
          permanentFailure: res.status === 400 || res.status === 401 || res.status === 403,
        };
      }

      return {
        ok: true,
        providerRequestId: data?.messageId || data?.id || data?.data?.messageId || undefined,
        providerResponse: data,
      };
    } catch (e: any) {
      return {
        ok: false,
        errorMessage: e?.message || 'fetch failed',
        permanentFailure: false,
      };
    }
  },
};
