// Unified notification engine. Single entry point: `notify()`.
// Resolves recipients → respects preferences → renders templates → sends per
// channel → logs every attempt. Fail-soft: one channel's failure never blocks
// another, and we always return after attempts (never throw upstream).
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { renderTemplate } from './templates';
import { CRITICAL_EVENTS } from './types';
import type { NotifyArgs, NotificationRecipient, SendResult, NotificationEvent } from './types';

const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';
const SMS_ENABLED      = process.env.SMS_ENABLED === 'true';
const FAST2SMS_KEY     = process.env.FAST2SMS_API_KEY || '';

// ── Main entry point ─────────────────────────────────────────────
export async function notify(args: NotifyArgs): Promise<{ results: SendResult[] }> {
  try {
    const recipients = await resolveRecipients(args);
    const rendered = renderTemplate(args.event, args.data || {});
    const isCritical = CRITICAL_EVENTS.has(args.event);

    const all: SendResult[] = [];
    for (const r of recipients) {
      // Email: always for critical events; respects opt-in for non-critical
      if (r.email) {
        const allow = isCritical || (r.emailOptIn !== false);
        if (allow) {
          all.push(await sendEmailChannel(r, args, rendered));
        } else {
          all.push(await logSkipped(r, args, 'EMAIL', 'opted out'));
        }
      }
      // WhatsApp: gated by env + user opt-in
      if (r.phone) {
        if (WHATSAPP_ENABLED && r.whatsappOptIn !== false) {
          all.push(await sendWhatsappChannel(r, args, rendered));
        } else {
          all.push(await logSkipped(r, args, 'WHATSAPP',
            !WHATSAPP_ENABLED ? 'WHATSAPP_ENABLED=false' : 'opted out'));
        }
        // SMS: gated by env + user opt-in (separate from WhatsApp)
        if (SMS_ENABLED && r.smsOptIn === true) {
          all.push(await sendSmsChannel(r, args, rendered));
        } else if (SMS_ENABLED) {
          all.push(await logSkipped(r, args, 'SMS', 'opted out'));
        }
      }
    }
    return { results: all };
  } catch (e: any) {
    console.error('[notify] unexpected error', e);
    return { results: [{ channel: 'EMAIL', recipient: '?', status: 'FAILED', error: e?.message }] };
  }
}

// ── Recipient resolution ─────────────────────────────────────────
type ResolvedRecipient = NotificationRecipient & {
  emailOptIn?: boolean;
  whatsappOptIn?: boolean;
  smsOptIn?: boolean;
};

async function resolveRecipients(args: NotifyArgs): Promise<ResolvedRecipient[]> {
  const out: ResolvedRecipient[] = [];

  // Bundle explicit user IDs
  const userIds = new Set<string>();
  if (args.userId) userIds.add(args.userId);
  if (args.userIds) for (const id of args.userIds) userIds.add(id);

  // Add admins on request
  if (args.toAdmins) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] as any } },
      select: { id: true },
    });
    for (const a of admins) userIds.add(a.id);
  }

  if (userIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: {
        id: true, email: true, phone: true, name: true,
        emailOptIn: true, whatsappOptIn: true, smsOptIn: true,
        notificationPref: { select: { emailOptIn: true, whatsappOptIn: true, smsOptIn: true } },
      },
    });
    for (const u of users) {
      // Vendor users use the VendorNotificationPref row when present; everyone
      // else uses the legacy User.{email,whatsapp,sms}OptIn columns.
      const p = u.notificationPref;
      out.push({
        userId: u.id,
        email: u.email,
        phone: u.phone || undefined,
        name: u.name || undefined,
        emailOptIn:    p ? p.emailOptIn    : u.emailOptIn,
        whatsappOptIn: p ? p.whatsappOptIn : u.whatsappOptIn,
        smsOptIn:      p ? p.smsOptIn      : u.smsOptIn,
      });
    }
  }

  // Add explicit ad-hoc recipients
  if (args.recipients) {
    for (const r of args.recipients) {
      out.push({ ...r, emailOptIn: true, whatsappOptIn: false, smsOptIn: false });
    }
  }

  // Dedupe by email
  const seen = new Set<string>();
  return out.filter(r => {
    const key = r.email || `phone:${r.phone}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Channel: email (Resend via lib/email.ts) ─────────────────────
async function sendEmailChannel(r: ResolvedRecipient, args: NotifyArgs, t: { subject: string; html: string }): Promise<SendResult> {
  if (!r.email) return { channel: 'EMAIL', recipient: '?', status: 'SKIPPED', error: 'no email' };
  let log: any = null;
  try {
    log = await prisma.notificationLog.create({
      data: {
        userId: r.userId || null,
        event: args.event,
        channel: 'EMAIL',
        recipient: r.email,
        subject: t.subject,
        bodySnippet: t.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200),
        status: 'QUEUED',
        contextType: args.context?.type || null,
        contextId: args.context?.id || null,
      },
    });
    const res = await sendEmail({ to: r.email, subject: t.subject, html: t.html });
    if (res?.ok) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'SENT', providerId: res.id || null, deliveredAt: new Date() },
      });
      return { channel: 'EMAIL', recipient: r.email, status: 'SENT', providerId: res.id };
    } else {
      const err = typeof res?.error === 'string' ? res.error : JSON.stringify(res?.error || {});
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', errorMessage: err.slice(0, 500) },
      });
      return { channel: 'EMAIL', recipient: r.email, status: 'FAILED', error: err };
    }
  } catch (e: any) {
    if (log) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'FAILED', errorMessage: String(e?.message || e).slice(0, 500) },
      }).catch(() => {});
    }
    return { channel: 'EMAIL', recipient: r.email, status: 'FAILED', error: e?.message };
  }
}

// ── Channel: WhatsApp (Fast2SMS) ─────────────────────────────────
async function sendWhatsappChannel(r: ResolvedRecipient, args: NotifyArgs, t: { smsText: string }): Promise<SendResult> {
  if (!r.phone) return { channel: 'WHATSAPP', recipient: '?', status: 'SKIPPED', error: 'no phone' };
  let log: any = null;
  try {
    log = await prisma.notificationLog.create({
      data: {
        userId: r.userId || null,
        event: args.event,
        channel: 'WHATSAPP',
        recipient: r.phone,
        bodySnippet: t.smsText.slice(0, 200),
        status: 'QUEUED',
        contextType: args.context?.type || null,
        contextId: args.context?.id || null,
      },
    });
    if (!FAST2SMS_KEY) {
      const err = 'FAST2SMS_API_KEY missing';
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', errorMessage: err } });
      return { channel: 'WHATSAPP', recipient: r.phone, status: 'FAILED', error: err };
    }
    // Fast2SMS WhatsApp Business endpoint. May reject if no template approved
    // → log the provider error and move on (fail-soft).
    const digits = r.phone.replace(/^\+91/, '').replace(/[^\d]/g, '');
    const res = await fetch('https://www.fast2sms.com/dev/whatsapp', {
      method: 'POST',
      headers: { 'authorization': FAST2SMS_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: t.smsText, numbers: digits }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body?.return !== false) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'SENT', providerId: body?.request_id ? String(body.request_id) : null, deliveredAt: new Date() },
      });
      return { channel: 'WHATSAPP', recipient: r.phone, status: 'SENT' };
    } else {
      const err = body?.message ? (Array.isArray(body.message) ? body.message.join('; ') : String(body.message)) : `HTTP ${res.status}`;
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', errorMessage: err.slice(0, 500) } });
      return { channel: 'WHATSAPP', recipient: r.phone, status: 'FAILED', error: err };
    }
  } catch (e: any) {
    if (log) await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', errorMessage: String(e?.message || e).slice(0, 500) } }).catch(() => {});
    return { channel: 'WHATSAPP', recipient: r.phone || '?', status: 'FAILED', error: e?.message };
  }
}

// ── Channel: SMS (Fast2SMS DLT route, registry-driven) ───────────
// v23.35: uses SmsTemplate registry. Each event has its own DLT template+ID.
// Event name in NotifyArgs must match SmsTemplate.event (e.g. 'order_placed').
async function sendSmsChannel(r: ResolvedRecipient, args: NotifyArgs, t: { smsText: string }): Promise<SendResult> {
  if (!r.phone) return { channel: 'SMS', recipient: '?', status: 'SKIPPED', error: 'no phone' };
  let log: any = null;
  try {
    log = await prisma.notificationLog.create({
      data: {
        userId: r.userId || null,
        event: args.event,
        channel: 'SMS',
        recipient: r.phone,
        bodySnippet: t.smsText.slice(0, 200),
        status: 'QUEUED',
        contextType: args.context?.type || null,
        contextId: args.context?.id || null,
      },
    });
    if (!FAST2SMS_KEY) {
      const err = 'FAST2SMS_API_KEY missing';
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', errorMessage: err } });
      return { channel: 'SMS', recipient: r.phone, status: 'FAILED', error: err };
    }

    // Look up DLT template for this event (map NotificationEvent -> SmsEvent)
    const { getTemplate, markUsed, mapNotificationToSmsEvent } = await import('@/lib/sms-registry');
    const smsEvent = mapNotificationToSmsEvent(args.event);
    if (!smsEvent) {
      const err = `Event '${args.event}' has no SMS template mapping`;
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'SKIPPED', errorMessage: err } });
      return { channel: 'SMS', recipient: r.phone, status: 'SKIPPED', error: err };
    }
    const tpl = await getTemplate(smsEvent);
    if (!tpl) {
      const err = `No SMS template registered for event '${smsEvent}'`;
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'SKIPPED', errorMessage: err } });
      return { channel: 'SMS', recipient: r.phone, status: 'SKIPPED', error: err };
    }
    if (!tpl.ready) {
      const err = `SMS template '${args.event}' not ready (paste real DLT ID in /admin/settings/sms)`;
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'SKIPPED', errorMessage: err } });
      return { channel: 'SMS', recipient: r.phone, status: 'SKIPPED', error: err };
    }

    // Variable values are passed in via args.context.smsVars (caller responsibility) or fall back to smsText itself for single-var templates.
    const ctxVars = (args.context as any)?.smsVars as Record<string, string | number> | undefined;
    const varValues: string = tpl.varOrder
      .map(k => String(ctxVars?.[k] ?? ''))
      .join('|');

    const digits = r.phone.replace(/^\+91/, '').replace(/[^\d]/g, '');
    const params = new URLSearchParams({
      authorization: FAST2SMS_KEY,
      route: 'dlt',
      sender_id: process.env.FAST2SMS_SENDER_ID || 'NEEJEY',
      message: tpl.templateId,
      variables_values: varValues,
      numbers: digits,
    });
    const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`);
    const body = await res.json().catch(() => ({}));
    if (res.ok && body?.return !== false) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: 'SENT', providerId: body?.request_id ? String(body.request_id) : null, deliveredAt: new Date() },
      });
      await markUsed(smsEvent).catch(() => {});
      return { channel: 'SMS', recipient: r.phone, status: 'SENT' };
    } else {
      const err = body?.message ? (Array.isArray(body.message) ? body.message.join('; ') : String(body.message)) : `HTTP ${res.status}`;
      await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', errorMessage: err.slice(0, 500) } });
      return { channel: 'SMS', recipient: r.phone, status: 'FAILED', error: err };
    }
  } catch (e: any) {
    if (log) await prisma.notificationLog.update({ where: { id: log.id }, data: { status: 'FAILED', errorMessage: String(e?.message || e).slice(0, 500) } }).catch(() => {});
    return { channel: 'SMS', recipient: r.phone || '?', status: 'FAILED', error: e?.message };
  }
}

// ── Log a skip without attempting send ───────────────────────────
async function logSkipped(r: ResolvedRecipient, args: NotifyArgs, channel: 'EMAIL'|'WHATSAPP'|'SMS', reason: string): Promise<SendResult> {
  const recipient = channel === 'EMAIL' ? r.email : r.phone;
  if (!recipient) return { channel, recipient: '?', status: 'SKIPPED', error: 'no recipient' };
  try {
    await prisma.notificationLog.create({
      data: {
        userId: r.userId || null,
        event: args.event,
        channel: channel as any,
        recipient,
        status: 'SKIPPED',
        errorMessage: reason,
        contextType: args.context?.type || null,
        contextId: args.context?.id || null,
      },
    });
  } catch { /* logging is best-effort */ }
  return { channel, recipient, status: 'SKIPPED', error: reason };
}

// ── Re-export helpers ────────────────────────────────────────────
export type { NotificationEvent, NotifyArgs } from './types';
