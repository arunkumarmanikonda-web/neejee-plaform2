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
    const body = await req.json().catch(() => ({}));
    const statusEntity = body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0] || null;
    const status = body?.status || statusEntity?.status || '';
    const messageId = String(body?.messageId || body?.id || statusEntity?.id || '').trim();

    if (!messageId) return NextResponse.json({ ok: true, ignored: true });

    const statusMap: Record<string, string> = {
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
      undelivered: 'failed',
    };
    const internalStatus = statusMap[String(status).toLowerCase()];
    if (!internalStatus) return NextResponse.json({ ok: true, ignored: true });

    const providerRecord = {
      messageId,
      status: String(status).toLowerCase(),
      timestamp: body?.timestamp || statusEntity?.timestamp || null,
      errorCode: body?.error?.code || statusEntity?.errors?.[0]?.code || null,
      errorTitle: body?.error?.message || statusEntity?.errors?.[0]?.title || null,
    };

    const updateData: any = {
      providerResponseJson: providerRecord,
      status: internalStatus,
    };
    if (internalStatus === 'delivered') updateData.deliveredAt = new Date();
    if (internalStatus === 'read') {
      updateData.readAt = new Date();
      updateData.deliveredAt = new Date();
    }
    if (internalStatus === 'failed') {
      updateData.errorMessage = providerRecord.errorTitle || 'WhatsApp delivery failed';
    }

    await prisma.notificationDispatch.updateMany({
      where: { providerRequestId: messageId },
      data: updateData,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.warn('[webhooks.aisensy] processing failed:', error?.message);
    return NextResponse.json({ ok: true, suppressed: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: webhookSecretConfigured(process.env.AISENSY_WEBHOOK_SECRET) });
}
