// Transactional email helper — Resend integration with a no-send development fallback.
import { paiseToRupees } from './money';

const RESEND_API = 'https://api.resend.com/emails';
const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://neejee.com').replace(/\/$/, '');

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHttpUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return escapeHtml(url.toString());
  } catch {
    return null;
  }
}

function firstName(value: unknown): string {
  const first = String(value || 'friend').trim().split(/\s+/)[0] || 'friend';
  return escapeHtml(first.slice(0, 80));
}

export async function sendEmail({ to, subject, html, replyTo }: SendEmailArgs) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'NEEJEE <hello@neejee.com>';

  if (!key) {
    console.info('[email] no RESEND_API_KEY; email suppressed', { subject: String(subject).slice(0, 160) });
    return { ok: true, dev: true };
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn('[email] Resend failed', {
        status: res.status,
        code: data?.name || data?.error?.name || null,
        subject: String(subject).slice(0, 160),
      });
      return { ok: false, error: 'Email provider rejected the request' };
    }
    console.info('[email] sent', { id: data?.id || null, subject: String(subject).slice(0, 160) });
    return { ok: true, id: data.id };
  } catch (error: any) {
    console.warn('[email] Resend exception', { message: error?.message });
    return { ok: false, error: 'Email provider unavailable' };
  }
}

const brandHeader = `
  <div style="background:#1A1613;padding:36px 24px;text-align:center;">
    <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td style="font-family:Georgia,'Playfair Display',serif;color:#F4EFE6;font-size:34px;letter-spacing:0.18em;font-weight:400;padding-right:6px;line-height:1;">NEE</td>
        <td style="padding:0 4px;vertical-align:middle;"><div style="width:8px;height:8px;background:#8B2E2A;border-radius:50%;display:inline-block;"></div></td>
        <td style="font-family:Georgia,'Playfair Display',serif;color:#F4EFE6;font-size:34px;letter-spacing:0.18em;font-weight:400;padding-left:6px;line-height:1;">JEE</td>
      </tr>
    </table>
    <div style="font-family:Georgia,serif;color:#A47E3B;font-size:10px;letter-spacing:0.35em;margin-top:14px;font-style:italic;">FOUND · PERSONAL</div>
  </div>`;

const brandFooter = `
  <div style="background:#F4EFE6;padding:28px 24px;text-align:center;color:#6B6862;font-size:12px;border-top:1px solid #1A161320;font-family:Georgia,serif;">
    <p style="margin:0 0 6px;font-style:italic;color:#1A1613;">Found. Personal.</p>
    <p style="margin:0 0 12px;font-size:11px;">Personally received by NEEJEE.</p>
    <p style="margin:0;font-size:11px;">
      <a href="${BASE_URL}" style="color:#8B2E2A;text-decoration:none;">neejee.com</a>
      &nbsp;·&nbsp; <a href="mailto:hello@neejee.com" style="color:#8B2E2A;text-decoration:none;">hello@neejee.com</a>
    </p>
    <p style="margin:14px 0 0;font-size:10px;color:#9C8B7A;letter-spacing:0.08em;">Order and account messages are sent when needed to provide the NEEJEE service.</p>
  </div>`;

export function orderPlacedEmail(order: any) {
  const items = (order.items || [])
    .map((item: any) => {
      const name = escapeHtml(item.name || item.product?.name || 'Item');
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const amount = paiseToRupees(item.subtotal || (Number(item.price || 0) * quantity));
      return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #1A161310;">
          <div style="font-family:Georgia,serif;font-size:14px;color:#1A1613;">${name}</div>
          <div style="font-size:11px;color:#6B6862;letter-spacing:0.1em;">QTY ${quantity} · ₹${amount}</div>
        </td>
      </tr>`;
    })
    .join('');

  const orderNumber = escapeHtml(order.orderNumber || '');
  const orderUrl = `${BASE_URL}/order-confirmation?order=${encodeURIComponent(String(order.orderNumber || ''))}`;

  return `
  <div style="max-width:560px;margin:0 auto;background:#fff;font-family:Georgia,serif;">
    ${brandHeader}
    <div style="padding:40px 32px;">
      <p style="font-size:11px;letter-spacing:0.3em;color:#8B2E2A;margin:0 0 8px;">PERSONALLY RECEIVED</p>
      <h1 style="font-size:28px;color:#1A1613;margin:0 0 16px;font-weight:400;">Namaste, ${firstName(order.customerName)}.</h1>
      <p style="color:#6B6862;line-height:1.7;font-size:14px;">Your order <strong style="color:#1A1613;">${orderNumber}</strong> is in our hands. We will inspect, sign, and pack each piece personally before it travels to you.</p>
      <table style="width:100%;margin-top:24px;border-collapse:collapse;">${items}</table>
      <table style="width:100%;margin-top:24px;font-size:13px;color:#1A1613;">
        <tr><td style="padding:6px 0;color:#6B6862;">Subtotal</td><td style="text-align:right;">₹${paiseToRupees(order.subtotal || 0)}</td></tr>
        ${order.discount ? `<tr><td style="padding:6px 0;color:#6B6862;">Discount</td><td style="text-align:right;color:#8B2E2A;">−₹${paiseToRupees(order.discount)}</td></tr>` : ''}
        <tr><td style="padding:6px 0;color:#6B6862;">Shipping</td><td style="text-align:right;">${order.shipping ? '₹' + paiseToRupees(order.shipping) : 'Complimentary'}</td></tr>
        <tr><td style="padding:6px 0;color:#6B6862;">GST</td><td style="text-align:right;">₹${paiseToRupees(order.tax || 0)}</td></tr>
        <tr><td style="padding:12px 0 0;border-top:1px solid #1A161320;font-weight:bold;">Total</td><td style="text-align:right;padding-top:12px;border-top:1px solid #1A161320;font-weight:bold;">₹${paiseToRupees(order.total || 0)}</td></tr>
      </table>
      <a href="${escapeHtml(orderUrl)}" style="display:inline-block;margin-top:32px;background:#1A1613;color:#F4EFE6;padding:14px 28px;text-decoration:none;letter-spacing:0.2em;font-size:12px;">VIEW ORDER</a>
    </div>
    ${brandFooter}
  </div>`;
}

export function orderShippedEmail(order: any) {
  const orderNumber = escapeHtml(order.orderNumber || '');
  const courier = escapeHtml(order.courier || 'our partner courier');
  const awb = order.awbNumber ? escapeHtml(order.awbNumber) : '';
  const trackingUrl = safeHttpUrl(order.trackingUrl);
  return `
  <div style="max-width:560px;margin:0 auto;background:#fff;font-family:Georgia,serif;">
    ${brandHeader}
    <div style="padding:40px 32px;">
      <p style="font-size:11px;letter-spacing:0.3em;color:#A47E3B;margin:0 0 8px;">ON ITS WAY</p>
      <h1 style="font-size:28px;color:#1A1613;margin:0 0 16px;font-weight:400;">Your order is travelling.</h1>
      <p style="color:#6B6862;line-height:1.7;font-size:14px;">Order <strong>${orderNumber}</strong> shipped via <strong>${courier}</strong>.</p>
      ${awb ? `<p style="font-size:13px;color:#1A1613;">Tracking: <strong>${awb}</strong></p>` : ''}
      ${trackingUrl ? `<a href="${trackingUrl}" style="display:inline-block;margin-top:24px;background:#8B2E2A;color:#F4EFE6;padding:14px 28px;text-decoration:none;letter-spacing:0.2em;font-size:12px;">TRACK SHIPMENT</a>` : ''}
    </div>
    ${brandFooter}
  </div>`;
}

export function orderDeliveredEmail(order: any) {
  const orderNumber = escapeHtml(order.orderNumber || '');
  return `
  <div style="max-width:560px;margin:0 auto;background:#fff;font-family:Georgia,serif;">
    ${brandHeader}
    <div style="padding:40px 32px;">
      <p style="font-size:11px;letter-spacing:0.3em;color:#5A6F3F;margin:0 0 8px;">ARRIVED</p>
      <h1 style="font-size:28px;color:#1A1613;margin:0 0 16px;font-weight:400;">Welcome home.</h1>
      <p style="color:#6B6862;line-height:1.7;font-size:14px;">Order <strong>${orderNumber}</strong> has been delivered. We hope the piece settles into your life with quiet grace.</p>
      <p style="color:#6B6862;line-height:1.7;font-size:13px;margin-top:24px;">If you have a moment, we would treasure your reflections. Share a review after signing in to the account used for your purchase.</p>
      <a href="${BASE_URL}/account?tab=orders" style="display:inline-block;margin-top:24px;background:#1A1613;color:#F4EFE6;padding:14px 28px;text-decoration:none;letter-spacing:0.2em;font-size:12px;">WRITE A REVIEW</a>
    </div>
    ${brandFooter}
  </div>`;
}

export function welcomeEmail(name: string, couponCode?: string) {
  const displayName = firstName(name);
  const code = escapeHtml((couponCode || 'WELCOME10').slice(0, 80));
  return `
  <div style="max-width:580px;margin:0 auto;background:#fff;font-family:Georgia,'Playfair Display',serif;">
    ${brandHeader}
    <div style="padding:52px 36px 12px;">
      <p style="font-size:10px;letter-spacing:0.35em;color:#8B2E2A;margin:0 0 16px;font-family:Georgia,serif;">A PERSONAL HELLO</p>
      <h1 style="font-size:34px;color:#1A1613;margin:0 0 6px;font-weight:400;line-height:1.2;">Namaste, ${displayName}.</h1>
      <p style="font-size:16px;color:#6B6862;margin:0 0 28px;font-style:italic;font-family:Georgia,serif;">निजी — the personal you. The personal me.</p>
      <p style="color:#1A1613;line-height:1.8;font-size:16px;margin:0 0 18px;">NEEJEE means <em>personal</em>. The part of you no one else gets a say in.</p>
      <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">Not curated by a trend. What you choose here is chosen by you alone — by the eye, by the hand, by what feels right.</p>
      <p style="color:#6B6862;line-height:1.8;font-size:14px;margin:0 0 18px;">Every piece on NEEJEE was found, not manufactured. Touched twice before it travels to you — once by the maker's hands, once by ours.</p>
      <p style="color:#1A1613;line-height:1.8;font-size:15px;margin:0 0 36px;font-style:italic;">That is what <em>personal</em> looks like, slowed down.</p>
    </div>
    <div style="margin:0 36px;padding:32px 24px;background:#F4EFE6;border:1px dashed #8B2E2A;text-align:center;">
      <p style="font-size:10px;letter-spacing:0.3em;color:#8B2E2A;margin:0 0 10px;font-family:Georgia,serif;">A KEY, IN YOUR NAME</p>
      <p style="font-family:Georgia,serif;font-size:13px;color:#1A1613;margin:0 0 16px;font-style:italic;">Made for you alone. 10% off your first piece.</p>
      <div style="display:inline-block;background:#1A1613;color:#F4EFE6;padding:14px 28px;font-family:'Courier New',monospace;font-size:18px;letter-spacing:0.25em;">${code}</div>
      <p style="font-size:10px;color:#9C8B7A;margin:14px 0 0;letter-spacing:0.12em;">Single use · Yours alone · Subject to code validity</p>
    </div>
    <div style="padding:36px 36px 48px;text-align:center;">
      <a href="${BASE_URL}/products" style="display:inline-block;background:#1A1613;color:#F4EFE6;padding:16px 36px;text-decoration:none;letter-spacing:0.25em;font-size:12px;font-family:Georgia,serif;">FIND YOUR PIECE</a>
      <p style="font-size:13px;color:#6B6862;margin:32px 0 0;font-style:italic;line-height:1.6;">With respect for what is yours,<br/>— Nidhi<br/><span style="font-size:11px;color:#9C8B7A;font-style:normal;letter-spacing:0.2em;">FOUNDER · NEEJEE</span></p>
    </div>
    ${brandFooter}
  </div>`;
}
