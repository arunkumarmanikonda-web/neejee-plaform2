import type {
  ChannelAdapter,
  ChannelSendResult,
  DispatchRecord,
  NotificationEvent,
} from '../types';

function firstEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = (process.env[key] || '').trim();
    if (value) return value;
  }
  return undefined;
}

function templateIdForEvent(event: NotificationEvent): string | undefined {
  switch (event) {
    case 'OTP_LOGIN':
    case 'OTP_SIGNUP':
      return firstEnv('FAST2SMS_TPL_OTP', 'FAST2SMS_OTP_TEMPLATE_ID');

    case 'ORDER_PLACED':
      return firstEnv('FAST2SMS_TPL_ORDER_PLACED', 'FAST2SMS_TPL_ORDER_COD_PLACED');

    case 'ORDER_CONFIRMED':
      return firstEnv('FAST2SMS_TPL_ORDER_CONFIRMED', 'FAST2SMS_TPL_PAYMENT_RECEIVED');

    case 'ORDER_PACKED':
      return firstEnv('FAST2SMS_TPL_ORDER_PACKED');

    case 'ORDER_SHIPPED':
      return firstEnv('FAST2SMS_TPL_ORDER_SHIPPED');

    case 'ORDER_OUT_FOR_DELIVERY':
      return firstEnv('FAST2SMS_TPL_OUT_FOR_DELIVERY', 'FAST2SMS_TPL_OFD');

    case 'ORDER_DELIVERED':
      return firstEnv('FAST2SMS_TPL_ORDER_DELIVERED', 'FAST2SMS_TPL_DELIVERED');

    case 'ORDER_CANCELLED':
      return firstEnv('FAST2SMS_TPL_ORDER_CANCELLED', 'FAST2SMS_TPL_CANCELLED');

    case 'ORDER_REFUNDED':
      return firstEnv('FAST2SMS_TPL_REFUND_PROCESSED', 'FAST2SMS_TPL_ORDER_REFUNDED');

    case 'CART_T1H':
    case 'CART_T24H':
    case 'CART_T72H':
    case 'CART_T7D':
    case 'CART_ABANDONED_T1H':
    case 'CART_ABANDONED_T24H':
    case 'CART_ABANDONED_T72H':
    case 'CART_ABANDONED_T7D':
      return firstEnv(
        'FAST2SMS_TPL_ABANDONED_CART',
        'FAST2SMS_TPL_T1H_NUDGE',
        'FAST2SMS_TPL_T24H_KARIGAR',
        'FAST2SMS_TPL_T72H_FAREWELL'
      );

    case 'TELECALLER_HANDOFF':
      return firstEnv('FAST2SMS_TPL_TELECALLER_HANDOFF', 'FAST2SMS_TPL_TELECALLER');

    case 'SELLER_ORDER_READY_TO_DISPATCH':
      return firstEnv('FAST2SMS_TPL_SELLER_ORDER_READY', 'FAST2SMS_TPL_SELLER_ORDER_DISPATCH');

    case 'SELLER_PAYOUT_PAID':
      return firstEnv('FAST2SMS_TPL_SELLER_PAYOUT', 'FAST2SMS_TPL_SELLER_PAYOUT_PROCESSED');

    case 'SELLER_INVENTORY_APPROVED':
      return firstEnv('FAST2SMS_TPL_PRODUCT_QC_APPROVED');

    case 'SELLER_INVENTORY_REJECTED':
      return firstEnv('FAST2SMS_TPL_PRODUCT_QC_REJECTED');

    default:
      return undefined;
  }
}

function varOrderForEvent(event: NotificationEvent): string[] {
  switch (event) {
    case 'OTP_LOGIN':
    case 'OTP_SIGNUP':
      return ['firstName', 'otpCode'];

    case 'ORDER_PLACED':
      return ['firstName', 'orderNumber'];

    case 'ORDER_CONFIRMED':
      return ['firstName', 'orderNumber'];

    case 'ORDER_PACKED':
      return ['firstName', 'orderNumber'];

    case 'ORDER_SHIPPED':
      return ['firstName', 'orderNumber'];

    case 'ORDER_OUT_FOR_DELIVERY':
      return ['firstName'];

    case 'ORDER_DELIVERED':
      return ['firstName'];

    case 'ORDER_CANCELLED':
      return ['firstName', 'orderNumber'];

    case 'ORDER_REFUNDED':
      return ['firstName', 'orderNumber'];

    case 'CART_T1H':
    case 'CART_T24H':
    case 'CART_T72H':
    case 'CART_T7D':
    case 'CART_ABANDONED_T1H':
    case 'CART_ABANDONED_T24H':
    case 'CART_ABANDONED_T72H':
    case 'CART_ABANDONED_T7D':
      return ['firstName', 'recoveryLink'];

    case 'TELECALLER_HANDOFF':
      return ['caseRef', 'adminLink'];

    case 'SELLER_ORDER_READY_TO_DISPATCH':
      return ['firstName', 'orderNumber'];

    case 'SELLER_PAYOUT_PAID':
      return ['firstName', 'payoutRef'];

    case 'SELLER_INVENTORY_APPROVED':
    case 'SELLER_INVENTORY_REJECTED':
      return ['firstName', 'submissionRef'];

    default:
      return [];
  }
}

const VAR_ALIASES: Record<string, string[]> = {
  firstName: ['customerName', 'name', 'sellerName', 'vendorName', 'first_name'],
  orderNumber: ['orderRef', 'reference', 'order_id'],
  recoveryLink: ['recoverLink', 'cartLink', 'link', 'checkoutLink'],
  adminLink: ['reviewLink', 'link'],
  caseRef: ['cartId', 'reference'],
  payoutRef: ['reference', 'orderNumber'],
  submissionRef: ['reference', 'productSubmissionId', 'submissionId'],
};

function resolveVar(
  variables: Record<string, any> | null | undefined,
  key: string
): string | undefined {
  if (!variables) return undefined;

  const candidates = [key, ...(VAR_ALIASES[key] || [])];
  for (const candidate of candidates) {
    const value = variables[candidate];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }

  if (key === 'firstName') return 'Customer';
  return undefined;
}

function normalizePhone(p: string): string {
  const digits = String(p || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
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
      return {
        ok: false,
        errorMessage: 'FAST2SMS_API_KEY not set',
        permanentFailure: false,
      };
    }

    const messageId = templateIdForEvent(d.event);
    if (!messageId) {
      return {
        ok: false,
        errorMessage: `No Fast2SMS DLT template configured for event ${d.event}`,
        permanentFailure: true,
      };
    }

    const order = varOrderForEvent(d.event);
    const values: string[] = [];

    for (const key of order) {
      const value = resolveVar(d.variables as Record<string, any>, key);
      if (value === undefined) {
        return {
          ok: false,
          errorMessage: `Missing required variable: ${key} for event ${d.event}`,
          permanentFailure: true,
        };
      }
      values.push(value);
    }

    const phone = normalizePhone(d.recipient);
    if (!phone || phone.length !== 10) {
      return {
        ok: false,
        errorMessage: `Invalid phone: ${d.recipient}`,
        permanentFailure: true,
      };
    }

    const params = new URLSearchParams({
      authorization: apiKey,
      route: 'dlt',
      sender_id: senderId,
      message: messageId,
      variables_values: values.join('|'),
      flash: '0',
      numbers: phone,
    });

    if (process.env.FAST2SMS_DLT_ENTITY_ID) {
      params.append('entity_id', process.env.FAST2SMS_DLT_ENTITY_ID);
    }

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(15000),
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
