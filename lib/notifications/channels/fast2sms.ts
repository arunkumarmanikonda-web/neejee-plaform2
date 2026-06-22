// lib/notifications/channels/fast2sms.ts
// v26.3b — Fast2SMS DLT adapter.
//
// Uses the "DLT" route of Fast2SMS bulkV2 endpoint with sender_id=NEEJEY.
// Each NotificationEvent maps to a specific DLT-approved Content Template ID,
// pulled from env vars (FAST2SMS_TPL_*).
//
// Variables are positional and substituted into {#var#} slots in the order
// the DLT template was registered. The orchestrator passes them as an
// ordered array under `variables.__positional` (we accept both shapes for
// flexibility).

import type { ChannelAdapter, ChannelSendResult, DispatchRecord, NotificationEvent } from '../types';

const TEMPLATE_ENV_MAP: Partial<Record<NotificationEvent, string>> = {
  CART_T1H:                'FAST2SMS_TPL_T1H_NUDGE',
  CART_T24H:               'FAST2SMS_TPL_T24H_KARIGAR',
  CART_T72H:               'FAST2SMS_TPL_T72H_FAREWELL',
  TELECALLER_HANDOFF:      'FAST2SMS_TPL_TELECALLER',
  OTP_LOGIN:               'FAST2SMS_TPL_OTP',
  OTP_SIGNUP:              'FAST2SMS_TPL_OTP',
  ORDER_PLACED:            'FAST2SMS_TPL_ORDER_PLACED',
  ORDER_SHIPPED:           'FAST2SMS_TPL_ORDER_SHIPPED',
  ORDER_OUT_FOR_DELIVERY:  'FAST2SMS_TPL_OFD',
  ORDER_DELIVERED:         'FAST2SMS_TPL_DELIVERED',
  ORDER_CANCELLED:         'FAST2SMS_TPL_CANCELLED',
};

// Positional variable order per event — MUST match the DLT template registration order
const VAR_ORDER: Partial<Record<NotificationEvent, string[]>> = {
  CART_T1H:                ['firstName', 'recoveryLink'],
  CART_T24H:               ['firstName', 'discountPct', 'code', 'recoveryLink'],
  CART_T72H:               ['firstName', 'discountPct', 'code', 'recoveryLink'],
  TELECALLER_HANDOFF:      ['customerName', 'customerPhone', 'trunkRupees', 'adminLink'],
  OTP_LOGIN:               ['otpCode'],
  OTP_SIGNUP:              ['otpCode'],
  ORDER_PLACED:            ['firstName', 'orderNumber', 'totalRupees', 'trackLink'],
  ORDER_SHIPPED:           ['firstName', 'orderNumber', 'awbNumber', 'courier', 'trackLink'],
  ORDER_OUT_FOR_DELIVERY:  ['firstName', 'orderNumber'],
  ORDER_DELIVERED:         ['firstName', 'orderNumber'],
  ORDER_CANCELLED:         ['firstName', 'orderNumber', 'refundRupees'],
};

function normalizePhone(p: string): string {
  // Strip everything non-numeric, ensure 10-digit Indian mobile (Fast2SMS expects "919876543210" or "9876543210")
  const digits = p.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  if (digits.length === 10) return digits;
  return digits; // pass through, Fast2SMS will validate
}

export const fast2smsAdapter: ChannelAdapter = {
  name: 'fast2sms',
  channel: 'SMS',

  isConfigured() {
    return !!process.env.FAST2SMS_API_KEY && !!process.env.FAST2SMS_SENDER_ID;
  },

  async send(d: DispatchRecord): Promise<ChannelSendResult> {
    const apiKey = process.env.FAST2SMS_API_KEY;
    const senderId = process.env.FAST2SMS_SENDER_ID || 'NEEJEY';
    const baseUrl = process.env.FAST2SMS_BASE_URL || 'https://www.fast2sms.com/dev/bulkV2';

    if (!apiKey) {
      return { ok: false, errorMessage: 'FAST2SMS_API_KEY not set', permanentFailure: false };
    }

    const tplEnv = TEMPLATE_ENV_MAP[d.event];
    const messageId = tplEnv ? process.env[tplEnv] : undefined;
    if (!messageId) {
      return {
        ok: false,
        errorMessage: `Template env var ${tplEnv} not set for event ${d.event}`,
        permanentFailure: true,  // missing template id is permanent until config
      };
    }

    // Build positional variable values string: "val1|val2|val3"
    const order = VAR_ORDER[d.event] || [];
    const values: string[] = [];
    for (const key of order) {
      const v = d.variables![key];
      if (v === undefined || v === null) {
        return {
          ok: false,
          errorMessage: `Missing required variable: ${key} for event ${d.event}`,
          permanentFailure: true,
        };
      }
      values.push(String(v));
    }
    const variablesValues = values.join('|');

    const phone = normalizePhone(d.recipient);
    if (!phone || phone.length < 10) {
      return { ok: false, errorMessage: `Invalid phone: ${d.recipient}`, permanentFailure: true };
    }

    // Fast2SMS DLT route v2 — POST form-encoded
    const params = new URLSearchParams({
      authorization: apiKey,
      route: 'dlt',
      sender_id: senderId,
      message: messageId,
      variables_values: variablesValues,
      flash: '0',
      numbers: phone,
    });

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.return === false) {
        return {
          ok: false,
          providerResponse: data,
          errorMessage: data?.message?.[0] || data?.message || `HTTP ${res.status}`,
          permanentFailure: res.status === 400 || res.status === 401,
        };
      }

      return {
        ok: true,
        providerRequestId: data?.request_id || data?.message?.[0] || undefined,
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
