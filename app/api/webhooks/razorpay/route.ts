// Razorpay webhook handler.
//
// Configure on https://dashboard.razorpay.com/app/webhooks:
//   URL:    https://www.neejee.com/api/webhooks/razorpay
//   Secret: <value> → set as RAZORPAY_WEBHOOK_SECRET in Vercel env
//   Events: payment.captured, payment.failed, refund.processed
//
// On payment.captured we auto-ingest the gateway fee as an APPROVED expense
// under the PAY_RAZORPAY category (idempotent by sourceRef = payment id).

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Constant-time compare
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function recordGatewayFee(payment: any) {
  // Razorpay returns fee & tax in paise on the payment object.
  // Total ingested expense = fee (excl GST) + GST on fee.
  const paymentId = payment.id as string;
  const fee = payment.fee as number | undefined;       // includes GST
  const tax = payment.tax as number | undefined;       // GST portion
  if (!paymentId || !fee) return { skipped: 'no fee on payment' };

  // Idempotency: skip if already ingested
  const already = await prisma.expense.findFirst({
    where: { source: 'RAZORPAY_WEBHOOK', sourceRef: paymentId },
    select: { id: true },
  });
  if (already) return { skipped: 'duplicate', id: already.id };

  const category = await prisma.expenseCategory.findUnique({
    where: { code: 'PAY_RAZORPAY' },
  });
  if (!category) return { skipped: 'PAY_RAZORPAY category not found — seed first' };

  // Try to link to our internal order via razorpayPaymentId
  let orderId: string | null = null;
  const order = await prisma.order.findFirst({
    where: { razorpayPaymentId: paymentId },
    select: { id: true, orderNumber: true },
  });
  if (order) orderId = order.id;

  const gstPaise = tax || 0;
  const netFee = (fee || 0) - gstPaise;
  const incurredOn = payment.created_at
    ? new Date(payment.created_at * 1000)
    : new Date();

  const expense = await prisma.expense.create({
    data: {
      categoryId: category.id,
      description: `Razorpay gateway fee for ${order?.orderNumber || paymentId}`,
      amountPaise: netFee,
      gstPaise,
      totalPaise: netFee + gstPaise,
      incurredOn,
      paidOn: incurredOn,                          // settled with the payment
      invoiceNumber: paymentId,
      status: 'APPROVED',
      createdByUserId: 'system',                   // sentinel for webhook-ingested
      reviewedByUserId: 'system',
      reviewedAt: new Date(),
      reviewNote: 'Auto-approved (Razorpay webhook)',
      source: 'RAZORPAY_WEBHOOK',
      sourceRef: paymentId,
      orderId,
    },
  });
  return { ok: true, id: expense.id };
}

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'RAZORPAY_WEBHOOK_SECRET not set' }, { status: 503 });
  }

  // Verify signature (Razorpay uses X-Razorpay-Signature header)
  const signature = req.headers.get('x-razorpay-signature') || '';
  const raw = await req.text();
  if (!signature || !verifySignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const eventName = event?.event as string | undefined;
  try {
    if (eventName === 'payment.captured') {
      const payment = event?.payload?.payment?.entity;
      if (payment) {
        const result = await recordGatewayFee(payment);
        return NextResponse.json({ event: eventName, result });
      }
    }
    // Add more handlers as needed (refund.processed, payment.failed)
    return NextResponse.json({ event: eventName, ignored: true });
  } catch (err: any) {
    console.error('[razorpay.webhook]', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
