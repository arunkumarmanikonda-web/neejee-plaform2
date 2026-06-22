// app/api/webhooks/fast2sms/route.ts
// v26.3b — Fast2SMS delivery receipt webhook.
//
// Fast2SMS posts delivery reports here when an SMS is delivered/failed.
// Typical payload includes: request_id, status, mobile_no, delivered_at, error_msg.
//
// Configure in Fast2SMS dashboard → DLT Manager → Webhooks → "Delivery Reports URL":
//   https://www.neejee.com/api/webhooks/fast2sms

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    let body: any = {};
    try { body = await req.json(); } catch {
      // Fast2SMS sometimes sends form-encoded — try to parse
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    const requestId = String(body.request_id || body.requestId || '');
    const status = String(body.status || '').toUpperCase();
    if (!requestId) {
      return NextResponse.json({ ok: true, ignored: 'no request_id' });
    }

    // Map provider status → our internal status
    const statusMap: Record<string, string> = {
      DELIVERED: 'delivered',
      DELIVRD:   'delivered',
      SENT:      'sent',
      FAILED:    'failed',
      UNDELIV:   'failed',
      REJECTED:  'failed',
      EXPIRED:   'failed',
    };
    const internalStatus = statusMap[status] || (status.includes('DELIV') ? 'delivered' : 'failed');

    const updateData: any = {
      providerResponseJson: body,
    };
    if (internalStatus === 'delivered') updateData.deliveredAt = new Date();
    if (internalStatus === 'failed') updateData.errorMessage = body.error_msg || body.error || `Provider status: ${status}`;
    updateData.status = internalStatus;

    await prisma.notificationDispatch.updateMany({
      where: { providerRequestId: requestId },
      data: updateData,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.warn('[webhooks.fast2sms]', e?.message);
    // Always return 200 to webhook so Fast2SMS doesn't retry endlessly
    return NextResponse.json({ ok: true, suppressed: true });
  }
}

// Some providers ping with GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'fast2sms-webhook' });
}
