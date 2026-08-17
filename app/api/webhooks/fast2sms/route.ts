// Fast2SMS delivery receipt webhook.
// Callback URL must carry FAST2SMS_WEBHOOK_SECRET via Bearer auth,
// x-neejee-webhook-token, or ?token=<secret>.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySharedWebhookSecret, webhookSecretConfigured } from '@/lib/webhooks/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function parseBody(raw: string, contentType: string): any {
  if (contentType.includes('application/json')) {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

export async function POST(req: Request) {
  const secret = process.env.FAST2SMS_WEBHOOK_SECRET;
  if (!webhookSecretConfigured(secret)) {
    console.error('[webhooks.fast2sms] FAST2SMS_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook unavailable' }, { status: 503 });
  }
  if (!verifySharedWebhookSecret(req, secret)) {
    return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
  }

  try {
    const raw = await req.text();
    const body = parseBody(raw, req.headers.get('content-type') || '');
    const requestId = String(body.request_id || body.requestId || '').trim();
    const status = String(body.status || '').trim().toUpperCase();

    if (!requestId) return NextResponse.json({ ok: true, ignored: true });

    const statusMap: Record<string, string> = {
      DELIVERED: 'delivered',
      DELIVRD: 'delivered',
      SENT: 'sent',
      FAILED: 'failed',
      UNDELIV: 'failed',
      REJECTED: 'failed',
      EXPIRED: 'failed',
    };
    const internalStatus = statusMap[status] || (status.includes('DELIV') ? 'delivered' : null);
    if (!internalStatus) return NextResponse.json({ ok: true, ignored: true });

    const providerRecord = {
      requestId,
      status,
      deliveredAt: body.delivered_at || body.deliveredAt || null,
      errorCode: body.error_code || null,
      errorMessage: body.error_msg || body.error || null,
    };

    const updateData: any = {
      providerResponseJson: providerRecord,
      status: internalStatus,
    };
    if (internalStatus === 'delivered') updateData.deliveredAt = new Date();
    if (internalStatus === 'failed') {
      updateData.errorMessage = providerRecord.errorMessage || `Provider status: ${status}`;
    }

    await prisma.notificationDispatch.updateMany({
      where: { providerRequestId: requestId },
      data: updateData,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.warn('[webhooks.fast2sms] processing failed:', error?.message);
    return NextResponse.json({ ok: true, suppressed: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: webhookSecretConfigured(process.env.FAST2SMS_WEBHOOK_SECRET) });
}
