// lib/notifications/dispatcher.ts
// v26.3b — Central dispatcher. Writes the DB row, calls the adapter,
// updates status, schedules retries via NotificationDispatch.nextRetryAt.
//
// Use:
//   await dispatchSms({ event: 'OTP_LOGIN', recipient: '+919876543210',
//                       variables: { otpCode: '123456' } });
//   await dispatchWhatsApp({ event: 'ORDER_SHIPPED', recipient: phone,
//                            variables: {...}, orderId, userId });

import { prisma } from '@/lib/prisma';
import { fast2smsAdapter } from './channels/fast2sms';
import { aisensyAdapter } from './channels/aisensy';
import type { Channel, ChannelAdapter, DispatchRecord, NotificationEvent } from './types';

const ADAPTERS: Record<Channel, ChannelAdapter | null> = {
  SMS:      fast2smsAdapter,
  WHATSAPP: aisensyAdapter,
  EMAIL:    null,
  SLACK: null,  // email handled by existing lib/email.ts pipeline
};

export interface DispatchOptions {
  event: NotificationEvent;
  recipient: string;
  variables: Record<string, string | number | undefined | null>;
  userId?: string | null;
  orderId?: string | null;
  cartId?: string | null;
  // Force a channel; otherwise picks based on event default
  channel?: Channel;
}

function normalizeVars(v: DispatchOptions['variables']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (val === undefined || val === null) continue;
    out[k] = String(val);
  }
  return out;
}

async function dispatchOnChannel(channel: Channel, opts: DispatchOptions) {
  const adapter = ADAPTERS[channel];
  if (!adapter) {
    return { ok: false, error: `No adapter for channel ${channel}` };
  }

  // Persist a dispatch row BEFORE calling the provider so we have an audit
  // trail even if the request hangs.
  const variables = normalizeVars(opts.variables);
  const templateName = `${channel}.${opts.event.toLowerCase()}`;

  const row = await prisma.notificationDispatch.create({
    data: {
      channel,
      event: opts.event,
      templateName,
      recipient: opts.recipient,
      userId: opts.userId || null,
      orderId: opts.orderId || null,
      cartId: opts.cartId || null,
      status: 'queued',
      attempt: 1,
      maxAttempts: 3,
      payloadJson: variables as any,
    } as any,
  });

  // If adapter not configured, mark as failed (soft) and return — let the
  // retry cron re-attempt once env vars arrive.
  if (!adapter.isConfigured()) {
    await prisma.notificationDispatch.update({
      where: { id: row.id },
      data: {
        status: 'failed',
        errorMessage: `${adapter.name} not configured (env vars missing)`,
        nextRetryAt: new Date(Date.now() + 60 * 60 * 1000), // retry in 1 hour
      } as any,
    });
    return { ok: false, error: `${adapter.name} not configured`, dispatchId: row.id };
  }

  const dispatch: DispatchRecord = {
    id: row.id,
    channel,
    event: opts.event,
    templateName,
    recipient: opts.recipient,
    userId: opts.userId || null,
    orderId: opts.orderId || null,
    cartId: opts.cartId || null,
    variables,
    status: "queued",
    attempt: 1,
  };

  const result = await adapter.send(dispatch);

  if (result.ok) {
    await prisma.notificationDispatch.update({
      where: { id: row.id },
      data: {
        status: 'sent',
        providerRequestId: result.providerRequestId || null,
        providerResponseJson: result.providerResponse as any,
        sentAt: new Date(),
      } as any,
    });
    return { ok: true, dispatchId: row.id, providerRequestId: result.providerRequestId };
  }

  // Failure path — schedule retry unless permanent
  const isPermanent = !!result.permanentFailure;
  const attempt = 1;
  const nextRetry = isPermanent
    ? null
    : new Date(Date.now() + (5 ** attempt) * 60 * 1000); // 5 min, 25 min, 125 min backoff

  await prisma.notificationDispatch.update({
    where: { id: row.id },
    data: {
      status: 'failed',
      errorMessage: result.errorMessage,
      providerResponseJson: result.providerResponse as any,
      nextRetryAt: nextRetry,
    } as any,
  });

  return { ok: false, error: result.errorMessage, dispatchId: row.id, permanent: isPermanent };
}

export async function dispatchSms(opts: Omit<DispatchOptions, 'channel'>) {
  return dispatchOnChannel('SMS', opts);
}

export async function dispatchWhatsApp(opts: Omit<DispatchOptions, 'channel'>) {
  return dispatchOnChannel('WHATSAPP', opts);
}

/**
 * Multi-channel dispatch: fire SMS + WhatsApp (and optionally email) in
 * parallel, return summary. Used by the order-events module so a single
 * status flip cleanly fans out to all enabled channels.
 */
export async function dispatchMulti(opts: {
  event: NotificationEvent;
  channels: Channel[];
  phone?: string | null;
  email?: string | null;
  variables: Record<string, string | number | undefined | null>;
  userId?: string | null;
  orderId?: string | null;
  cartId?: string | null;
}) {
  const results: Record<string, any> = {};
  const jobs: Promise<any>[] = [];

  for (const ch of opts.channels) {
    const recipient = ch === 'EMAIL' ? opts.email : opts.phone;
    if (!recipient) {
      results[ch] = { ok: false, skipped: 'no recipient' };
      continue;
    }
    if (ch === 'EMAIL') {
      // Email is handled elsewhere (existing lib/email.ts paths). Skip here
      // unless caller explicitly wires the email template through.
      results[ch] = { ok: false, skipped: 'email dispatch handled by event-specific code' };
      continue;
    }
    jobs.push(
      dispatchOnChannel(ch, {
        event: opts.event,
        recipient,
        variables: opts.variables,
        userId: opts.userId,
        orderId: opts.orderId,
        cartId: opts.cartId,
      }).then(r => { results[ch] = r; })
    );
  }

  await Promise.allSettled(jobs);
  return results;
}

// Convenience wrapper for retrying failed dispatches (called by cron)
export async function retryDispatch(dispatchId: string) {
  const row = await prisma.notificationDispatch.findUnique({ where: { id: dispatchId } });
  if (!row || row.status !== 'failed') return { ok: false, skipped: 'not failed' };
  if (row.attempt >= row.maxAttempts) return { ok: false, skipped: 'max attempts' };

  const adapter = ADAPTERS[row.channel as Channel];
  if (!adapter || !adapter.isConfigured()) {
    return { ok: false, skipped: 'adapter not configured' };
  }

  const variables = (row.payloadJson as any) || {};
  const dispatch: DispatchRecord = {
    id: row.id,
    channel: row.channel as Channel,
    event: row.event as NotificationEvent,
    templateName: row.templateName,
    recipient: row.recipient,
    userId: row.userId,
    orderId: row.orderId,
    cartId: row.cartId,
    variables,
    attempt: row.attempt + 1,
    maxAttempts: row.maxAttempts,
    status: "queued",
  };

  const result = await adapter.send(dispatch);

  if (result.ok) {
    await prisma.notificationDispatch.update({
      where: { id: row.id },
      data: {
        status: 'sent',
        attempt: row.attempt + 1,
        providerRequestId: result.providerRequestId || null,
        providerResponseJson: result.providerResponse as any,
        sentAt: new Date(),
        nextRetryAt: null,
      } as any,
    });
    return { ok: true };
  }

  const nextAttempt = row.attempt + 1;
  const nextRetry = nextAttempt >= row.maxAttempts || result.permanentFailure
    ? null
    : new Date(Date.now() + (5 ** nextAttempt) * 60 * 1000);

  await prisma.notificationDispatch.update({
    where: { id: row.id },
    data: {
      status: 'failed',
      attempt: nextAttempt,
      errorMessage: result.errorMessage,
      providerResponseJson: result.providerResponse as any,
      nextRetryAt: nextRetry,
    } as any,
  });
  return { ok: false, attempt: nextAttempt };
}
