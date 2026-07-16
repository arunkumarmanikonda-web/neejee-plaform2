import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import {
  buildVarValues,
  getTemplate,
  mapNotificationToSmsEvent,
  type SmsEvent,
} from '@/lib/sms-registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SMS_EVENTS: SmsEvent[] = [
  'otp_login',
  'order_placed',
  'payment_confirmed',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
  'refund_initiated',
  'abandoned_cart',
  'seller_payout',
  'vendor_payout',
];

function getHealth() {
  const configured = !!(
    process.env.FAST2SMS_API_KEY &&
    process.env.FAST2SMS_SENDER_ID &&
    process.env.FAST2SMS_ENTITY_ID
  );

  return {
    ok: true,
    configured,
    disabled: !configured,
    phase: configured ? 'configured' : 'phase0',
    provider: 'Fast2SMS',
    senderId: process.env.FAST2SMS_SENDER_ID || '',
    entityId: process.env.FAST2SMS_ENTITY_ID || '',
    mode: process.env.FAST2SMS_ROUTE || 'dlt',
    balance: null,
    message: configured
      ? 'Provider configuration is present. Manual admin test sending is enabled.'
      : 'SMS provider is not configured yet. Add Fast2SMS values in Settings to enable SMS.',
  };
}

async function gate() {
  const user = await getSession();
  return requireRole(user, ['ADMIN', 'SUPER_ADMIN'] as any);
}

function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function normalizeVars(input: unknown): Record<string, string | number> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, string | number>;
  }
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string | number>;
      }
    } catch {}
  }
  return {};
}

function resolveSmsEvent(input: string): SmsEvent | null {
  const raw = input.trim();
  if (!raw) return null;

  const mapped = mapNotificationToSmsEvent(raw.toUpperCase());
  if (mapped) return mapped;

  const lowered = raw.toLowerCase() as SmsEvent;
  return SMS_EVENTS.includes(lowered) ? lowered : null;
}

export async function GET() {
  if (!(await gate())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(getHealth());
}

function explainTemplateFailure(tpl: Awaited<ReturnType<typeof getTemplate>>, smsEvent: SmsEvent) {
  if (!tpl) {
    return `No SMS template found for event ${smsEvent}.`;
  }

  if (!tpl.active) {
    return `SMS template for event ${smsEvent} is inactive.`;
  }

  switch (tpl.invalidReason) {
    case 'missing_template_id':
      return `SMS template for event ${smsEvent} has no mapped Fast2SMS message ID.`;
    case 'entity_id_used':
      return `SMS template for event ${smsEvent} is using entity ID ${tpl.templateId} instead of an approved Fast2SMS message ID.`;
    case 'not_in_provider_catalog':
      return `SMS template for event ${smsEvent} is mapped to ${tpl.templateId}, but that ID is not present in the approved Fast2SMS provider catalog.`;
    default:
      return `Selected SMS template for event ${smsEvent} is missing, inactive, or not DLT-ready.`;
  }
}

export async function POST(req: NextRequest) {
  if (!(await gate())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const health = getHealth();
  if (!health.configured) {
    return NextResponse.json(
      {
        ...health,
        ok: false,
        error: health.message,
      },
      { status: 400 }
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const phone = normalizePhone(String(body?.phone || ''));
  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { ok: false, error: 'Valid 10-digit mobile number required.' },
      { status: 400 }
    );
  }

  const smsEvent = resolveSmsEvent(String(body?.event || ''));
  if (!smsEvent) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Valid SMS event required. Use one of: otp_login, order_placed, payment_confirmed, order_shipped, order_delivered, order_cancelled, refund_initiated, abandoned_cart, seller_payout, vendor_payout.',
      },
      { status: 400 }
    );
  }

  const tpl = await getTemplate(smsEvent);
  if (!tpl || !tpl.active || !tpl.ready) {
    return NextResponse.json(
      {
        ok: false,
        error: explainTemplateFailure(tpl, smsEvent),
        template: tpl
          ? {
              event: tpl.event,
              templateId: tpl.templateId,
              invalidReason: tpl.invalidReason,
              providerApproved: tpl.providerApproved,
            }
          : null,
      },
      { status: 400 }
    );
  }

  const vars = normalizeVars(body?.vars);
  const variablesValues = buildVarValues(tpl, vars);
  const senderId = tpl.providerSenderId || process.env.FAST2SMS_SENDER_ID || '';

  const url = new URL('https://www.fast2sms.com/dev/bulkV2');
  url.searchParams.set('route', process.env.FAST2SMS_ROUTE || 'dlt');
  url.searchParams.set('sender_id', senderId);
  url.searchParams.set('message', tpl.templateId);
  url.searchParams.set('numbers', phone);
  if (variablesValues) {
    url.searchParams.set('variables_values', variablesValues);
  }

  const providerRes = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      authorization: process.env.FAST2SMS_API_KEY || '',
    },
    cache: 'no-store',
  });

  const text = await providerRes.text();
  let providerData: any = null;
  try {
    providerData = text ? JSON.parse(text) : null;
  } catch {
    providerData = { raw: text };
  }

  const providerRejected =
    providerData?.return === false ||
    providerData?.return === 'false' ||
    providerData?.status === 'error' ||
    providerData?.status === 'ERROR' ||
    (providerData?.request_id === undefined && !providerRes.ok);

  if (!providerRes.ok || providerRejected) {
    return NextResponse.json(
      {
        ok: false,
        error:
          providerData?.message ||
          providerData?.error ||
          `Fast2SMS failed (${providerRes.status})`,
        providerResponse: providerData,
        template: {
          event: tpl.event,
          templateId: tpl.templateId,
          senderId,
          providerEntityId: tpl.providerEntityId,
        },
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    disabled: false,
    provider: 'Fast2SMS',
    requestId: providerData?.request_id || providerData?.requestId || null,
    message: 'SMS test request accepted.',
    template: {
      event: tpl.event,
      templateId: tpl.templateId,
      senderId,
      providerEntityId: tpl.providerEntityId,
    },
    providerResponse: providerData,
  });
}