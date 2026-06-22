// WhatsApp messaging helper — supports three providers:
//   1) Fast2SMS WhatsApp Business API     (cheapest, simplest, same account as SMS OTP)
//   2) WATI (https://wati.io)
//   3) Meta WhatsApp Cloud API direct
// Falls back to logging when none are configured.
//
// Activation (any one):
//   FAST2SMS_WHATSAPP_MESSAGE_ID=...  (Fast2SMS template/message id from their WA dashboard)
//   FAST2SMS_API_KEY=...              (same key you use for SMS)
// OR:
//   WATI_API_ENDPOINT=https://live-server-XXXX.wati.io
//   WATI_API_KEY=Bearer ...
// OR (Meta direct):
//   WA_PHONE_NUMBER_ID=...
//   WA_ACCESS_TOKEN=...

import { prisma } from './prisma';

const FAST2SMS_KEY = process.env.FAST2SMS_API_KEY;
const FAST2SMS_WA_ENABLED = process.env.FAST2SMS_WHATSAPP_ENABLED === 'true';
const WATI_ENDPOINT = process.env.WATI_API_ENDPOINT;
const WATI_KEY = process.env.WATI_API_KEY;
const META_PHONE_ID = process.env.WA_PHONE_NUMBER_ID;
const META_TOKEN = process.env.WA_ACCESS_TOKEN;

export function whatsappConfigured(): boolean {
  return !!(
    (FAST2SMS_KEY && FAST2SMS_WA_ENABLED) ||
    (WATI_ENDPOINT && WATI_KEY) ||
    (META_PHONE_ID && META_TOKEN)
  );
}

export type WhatsappResult = { ok: boolean; provider?: string; id?: string; error?: string; dev?: boolean };

/** Sanitize phone to E.164 digits-only (no +). */
function toDigits(phone: string): string {
  return String(phone).replace(/\D+/g, '');
}

/**
 * Send a WhatsApp text message. Free-form text only works inside the 24h
 * window after the customer last messaged; for proactive sends use template().
 */
export async function sendWhatsappText(args: { to: string; body: string }): Promise<WhatsappResult> {
  const to = toDigits(args.to);
  if (!to || to.length < 7) return { ok: false, error: 'invalid phone' };
  if (!whatsappConfigured()) {
    console.log('[whatsapp] DEV MODE (no provider configured) →', { to, body: args.body.slice(0, 80) });
    return { ok: true, dev: true };
  }

  // Fast2SMS WhatsApp takes priority if enabled (simplest, cheapest)
  if (FAST2SMS_KEY && FAST2SMS_WA_ENABLED) {
    try {
      const res = await fetch('https://www.fast2sms.com/dev/whatsapp', {
        method: 'POST',
        headers: {
          'authorization': FAST2SMS_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Fast2SMS WhatsApp uses message_id of pre-approved templates;
          // for free-form session messages they have a 'sendtext' variant.
          // We try the simple text endpoint first.
          message: args.body,
          numbers: to,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (res.ok && data.return !== false) {
        return { ok: true, provider: 'fast2sms-whatsapp', id: data.request_id };
      }
      console.warn('[whatsapp/fast2sms] failed:', text.slice(0, 300), '| to:', to);
      // Fall through to WATI / Meta
    } catch (e: any) {
      console.warn('[whatsapp/fast2sms] exception:', e.message);
    }
  }

  // WATI takes priority if both configured
  if (WATI_ENDPOINT && WATI_KEY) {
    try {
      const res = await fetch(`${WATI_ENDPOINT}/api/v1/sendSessionMessage/${to}?messageText=${encodeURIComponent(args.body)}`, {
        method: 'POST',
        headers: { Authorization: WATI_KEY.startsWith('Bearer') ? WATI_KEY : `Bearer ${WATI_KEY}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('[whatsapp/wati] failed:', JSON.stringify(data), '| to:', to);
        return { ok: false, provider: 'wati', error: JSON.stringify(data) };
      }
      console.log('[whatsapp/wati] sent', { to, body: args.body.slice(0, 50) });
      return { ok: true, provider: 'wati', id: data.id || data.messageId };
    } catch (e: any) {
      return { ok: false, provider: 'wati', error: e.message };
    }
  }

  // Meta direct
  if (META_PHONE_ID && META_TOKEN) {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_ID}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${META_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: args.body },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn('[whatsapp/meta] failed:', JSON.stringify(data));
        return { ok: false, provider: 'meta', error: JSON.stringify(data) };
      }
      return { ok: true, provider: 'meta', id: data.messages?.[0]?.id };
    } catch (e: any) {
      return { ok: false, provider: 'meta', error: e.message };
    }
  }

  return { ok: false, error: 'no provider' };
}

/**
 * Send a templated WhatsApp message (works outside 24h window).
 * WATI: templateName + parameters array.
 * Meta: requires pre-approved template.
 */
export async function sendWhatsappTemplate(args: {
  to: string;
  templateName: string;
  language?: string;
  parameters?: string[];
}): Promise<WhatsappResult> {
  const to = toDigits(args.to);
  const lang = args.language || 'en';
  if (!whatsappConfigured()) {
    console.log('[whatsapp] DEV template →', { to, template: args.templateName, params: args.parameters });
    return { ok: true, dev: true };
  }

  if (WATI_ENDPOINT && WATI_KEY) {
    try {
      const params = (args.parameters || []).map(v => ({ name: 'default', value: v }));
      const res = await fetch(`${WATI_ENDPOINT}/api/v1/sendTemplateMessage?whatsappNumber=${to}`, {
        method: 'POST',
        headers: {
          Authorization: WATI_KEY.startsWith('Bearer') ? WATI_KEY : `Bearer ${WATI_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_name: args.templateName,
          broadcast_name: `nj_${Date.now()}`,
          parameters: params,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, provider: 'wati', error: JSON.stringify(data) };
      return { ok: true, provider: 'wati', id: data.id };
    } catch (e: any) {
      return { ok: false, provider: 'wati', error: e.message };
    }
  }

  if (META_PHONE_ID && META_TOKEN) {
    try {
      const res = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_ID}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${META_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: args.templateName,
            language: { code: lang },
            components: (args.parameters || []).length
              ? [{ type: 'body', parameters: (args.parameters || []).map(v => ({ type: 'text', text: v })) }]
              : undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, provider: 'meta', error: JSON.stringify(data) };
      return { ok: true, provider: 'meta', id: data.messages?.[0]?.id };
    } catch (e: any) {
      return { ok: false, provider: 'meta', error: e.message };
    }
  }

  return { ok: false, error: 'no provider' };
}

/**
 * Check whether a user has consented to WhatsApp messages.
 * Returns the user's phone number if opted in, else null.
 */
export async function getWhatsappRecipient(userId: string): Promise<{ phone: string; name: string | null } | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, name: true, whatsappOptIn: true },
  });
  if (!u || !u.whatsappOptIn || !u.phone) return null;
  return { phone: u.phone, name: u.name };
}

// ─────── High-level helpers (each respects opt-in) ───────

export async function notifyOrderPlaced(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, total: true, userId: true, guestEmail: true },
  });
  if (!order || !order.userId) return;
  const r = await getWhatsappRecipient(order.userId);
  if (!r) return;
  const firstName = (r.name || '').split(' ')[0] || 'there';
  const inr = `₹${(order.total / 100).toLocaleString('en-IN')}`;
  await sendWhatsappText({
    to: r.phone,
    body: `Dear ${firstName}, your NEEJEE order ${order.orderNumber} (${inr}) has been received. We will pack it personally and share tracking once dispatched.\n\nPersonally,\nNidhi & team`,
  });
}

export async function notifyOrderShipped(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, awbNumber: true, courier: true, trackingUrl: true, userId: true },
  });
  if (!order || !order.userId) return;
  const r = await getWhatsappRecipient(order.userId);
  if (!r) return;
  const firstName = (r.name || '').split(' ')[0] || 'there';
  const trackingLine = order.trackingUrl
    ? `\n\nTrack here: ${order.trackingUrl}`
    : order.awbNumber
    ? `\n\nAWB: ${order.awbNumber}${order.courier ? ` (${order.courier})` : ''}`
    : '';
  await sendWhatsappText({
    to: r.phone,
    body: `Dear ${firstName}, your NEEJEE order ${order.orderNumber} is on its way.${trackingLine}\n\nPersonally,\nNidhi & team`,
  });
}

export async function notifyOrderDelivered(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, userId: true },
  });
  if (!order || !order.userId) return;
  const r = await getWhatsappRecipient(order.userId);
  if (!r) return;
  const firstName = (r.name || '').split(' ')[0] || 'there';
  await sendWhatsappText({
    to: r.phone,
    body: `Dear ${firstName}, your NEEJEE order ${order.orderNumber} has been delivered. We hope it lives well in your trunk.\n\nIf anything is amiss, write to hello@neejee.com — we read every email.\n\nPersonally,\nNidhi`,
  });
}

export async function notifyTierUp(userId: string, newTierLabel: string): Promise<void> {
  const r = await getWhatsappRecipient(userId);
  if (!r) return;
  const firstName = (r.name || '').split(' ')[0] || 'friend';
  await sendWhatsappText({
    to: r.phone,
    body: `Dear ${firstName}, you have crossed into ${newTierLabel} with us today. It means something to us that pieces from our atelier have found a home in yours.\n\nPersonally,\nNidhi`,
  });
}

export async function notifyAbandonedCart(userId: string | null, email: string, itemCount: number, subtotal: number): Promise<void> {
  if (!userId) return;
  const r = await getWhatsappRecipient(userId);
  if (!r) return;
  const firstName = (r.name || '').split(' ')[0] || 'there';
  const inr = `₹${(subtotal / 100).toLocaleString('en-IN')}`;
  await sendWhatsappText({
    to: r.phone,
    body: `Dear ${firstName}, you left ${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} (${inr}) in your trunk. No rush — we hold things personally.\n\nReturn anytime: https://www.neejee.com/cart`,
  });
}
