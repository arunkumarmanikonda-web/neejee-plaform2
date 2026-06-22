// app/api/webhooks/aisensy/route.ts
// v26.3b — AiSensy WhatsApp delivery/read receipts.
//
// Configure in AiSensy → Manage → Webhooks → "Message Status Webhook":
//   https://www.neejee.com/api/webhooks/aisensy
//
// AiSensy payloads typically include: messageId, status (sent/delivered/read/failed),
// timestamp, recipient, conversation, error.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* leave empty */ }

    // AiSensy sometimes nests inside `entry[0].changes[0].value.statuses[0]`
    // (Meta-style payload). Handle both shapes.
    const status =
      body?.status ||
      body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.status ||
      '';
    const messageId =
      body?.messageId ||
      body?.id ||
      body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.id ||
      '';

    if (!messageId) return NextResponse.json({ ok: true, ignored: 'no messageId' });

    const statusMap: Record<string, string> = {
      sent:      'sent',
      delivered: 'delivered',
      read:      'read',
      failed:    'failed',
      undelivered: 'failed',
    };
    const internalStatus = statusMap[String(status).toLowerCase()] || 'sent';

    const updateData: any = {
      providerResponseJson: body,
      status: internalStatus,
    };
    if (internalStatus === 'delivered') updateData.deliveredAt = new Date();
    if (internalStatus === 'read') {
      updateData.readAt = new Date();
      // Read implies delivered too
      if (!updateData.deliveredAt) updateData.deliveredAt = new Date();
    }
    if (internalStatus === 'failed') {
      updateData.errorMessage =
        body?.error?.message ||
        body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0]?.errors?.[0]?.title ||
        'WhatsApp delivery failed';
    }

    await prisma.notificationDispatch.updateMany({
      where: { providerRequestId: messageId },
      data: updateData,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.warn('[webhooks.aisensy]', e?.message);
    return NextResponse.json({ ok: true, suppressed: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'aisensy-webhook' });
}
