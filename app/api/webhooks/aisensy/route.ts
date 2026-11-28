// AiSensy WhatsApp delivery/read receipts.
// AiSensy does not provide a payload signature on this integration surface in
// NEEJEE, so the callback must carry AISENSY_WEBHOOK_SECRET via Bearer auth,
// x-neejee-webhook-token, or ?token=<secret>.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySharedWebhookSecret, webhookSecretConfigured } from '@/lib/webhooks/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const secret = process.env.AISENSY_WEBHOOK_SECRET;
  if (!webhookSecretConfigured(secret)) {
    console.error('[webhooks.aisensy] AISENSY_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 });
  }
  if (!verifySharedWebhookSecret(req, secret)) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
  }

  try {
    const body = await req.json();
    // WhatsApp can group delivery receipts across entries and changes in one callback.
    const receipts: any[] = Array.isArray(body?.entry)
      ? body.entry.flatMap((entry: any) => Array.isArray(entry?.changes)
        ? entry.changes.flatMap((change: any) => Array.isArray(change?.value?.statuses) ? change.value.statuses : [])
        : [])
      : [body];
    for (const receipt of receipts) {
      const messageId = String(receipt?.messageId || receipt?.id || '').trim();
      const raw = String(receipt?.status || '').toLowerCase();
      const status = raw === 'undelivered' ? 'failed' : raw;
      if (!messageId || !['sent','delivered','read','failed'].includes(status)) continue;
      const error = receipt.error || receipt.errors?.[0];
      const previous = status === 'read' ? ['queued','sent','delivered'] : status === 'sent' ? ['queued'] : ['queued','sent'];
      const now = new Date();
      const where = { channel: 'WHATSAPP', providerRequestId: messageId, status: { in: previous } };
      const data = {
        status, providerResponseJson: { messageId, status, timestamp: receipt.timestamp || null, errorCode: error?.code || null },
        ...(status === 'failed' ? { errorMessage: error?.title || error?.message || 'WhatsApp delivery failed' } : {}),
        ...(status === 'delivered' ? { deliveredAt: now } : {}),
        ...(status === 'read' ? { readAt: now } : {}),
      };
      if (status === 'read') {
        await prisma.notificationDispatch.updateMany({ where: { ...where, deliveredAt: null }, data: { ...data, deliveredAt: now } });
      }
      await prisma.notificationDispatch.updateMany({where, data});
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.warn('[webhooks.aisensy] receipt processing failed');
    return NextResponse.json({ error: 'Retry delivery receipt' }, { status: 503 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: webhookSecretConfigured(process.env.AISENSY_WEBHOOK_SECRET) });
}
