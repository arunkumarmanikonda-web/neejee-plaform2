// Razorpay webhook handler.
//
// Configure on https://dashboard.razorpay.com/app/webhooks:
//   URL:    https://www.neejee.com/api/webhooks/razorpay
//   Secret: <value> → set as RAZORPAY_WEBHOOK_SECRET in Vercel env
//   Events: payment.captured, payment.failed, refund.processed
//
// Webhook responsibilities:
//   - Verify Razorpay webhook signature
//   - Reconcile payment/refund status onto existing rows only
//   - Ingest gateway fee idempotently on payment.captured
//
// IMPORTANT:
//   - Do NOT create NEEJEE orders here
//   - Do NOT send ORDER_CONFIRMED here
//   - Do NOT run loyalty/finance posting here
// Those belong to /api/razorpay/verify in the prepaid flow.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

async function findOrderByGatewayRefs(paymentId?: string | null, razorpayOrderId?: string | null) {
  const or: Array<Record<string, string>> = [];
  if (paymentId) or.push({ razorpayPaymentId: paymentId });
  if (razorpayOrderId) or.push({ razorpayOrderId });

  if (or.length === 0) return null;

  return prisma.order.findFirst({
    where: { OR: or },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      status: true,
      razorpayPaymentId: true,
      razorpayOrderId: true,
      total: true,
    },
  });
}

async function findSnapshotForGatewayRefs(snapshotId?: string | null, razorpayOrderId?: string | null) {
  if (snapshotId) {
    const byId = await prisma.abandonedCart.findUnique({
      where: { id: snapshotId },
      select: {
        id: true,
        recoveredOrderId: true,
        lastSeenStep: true,
        razorpayOrderId: true,
      },
    });
    if (byId) return byId;
  }

  if (razorpayOrderId) {
    return prisma.abandonedCart.findFirst({
      where: { razorpayOrderId },
      select: {
        id: true,
        recoveredOrderId: true,
        lastSeenStep: true,
        razorpayOrderId: true,
      },
    });
  }

  return null;
}

async function recordGatewayFee(payment: any) {
  const paymentId = asNonEmptyString(payment?.id);
  const fee = typeof payment?.fee === 'number' ? payment.fee : undefined; // includes GST
  const tax = typeof payment?.tax === 'number' ? payment.tax : undefined; // GST portion

  if (!paymentId || fee == null) {
    return { skipped: 'no_fee_on_payment' };
  }

  const already = await prisma.expense.findFirst({
    where: { source: 'RAZORPAY_WEBHOOK', sourceRef: paymentId },
    select: { id: true },
  });
  if (already) {
    return { skipped: 'duplicate', id: already.id };
  }

  const category = await prisma.expenseCategory.findUnique({
    where: { code: 'PAY_RAZORPAY' },
  });
  if (!category) {
    return { skipped: 'missing_category_PAY_RAZORPAY' };
  }

  let orderId: string | null = null;
  let orderNumber: string | null = null;

  const linkedOrder = await prisma.order.findFirst({
    where: { razorpayPaymentId: paymentId },
    select: { id: true, orderNumber: true },
  });

  if (linkedOrder) {
    orderId = linkedOrder.id;
    orderNumber = linkedOrder.orderNumber;
  }

  const gstPaise = tax || 0;
  const netFee = fee - gstPaise;
  const incurredOn =
    typeof payment?.created_at === 'number'
      ? new Date(payment.created_at * 1000)
      : new Date();

  const expense = await prisma.expense.create({
    data: {
      categoryId: category.id,
      description: `Razorpay gateway fee for ${orderNumber || paymentId}`,
      amountPaise: netFee,
      gstPaise,
      totalPaise: netFee + gstPaise,
      incurredOn,
      paidOn: incurredOn,
      invoiceNumber: paymentId,
      status: 'APPROVED',
      createdByUserId: 'system',
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

async function reconcileCapturedPayment(payment: any) {
  const paymentId = asNonEmptyString(payment?.id);
  const razorpayOrderId = asNonEmptyString(payment?.order_id);

  const order = await findOrderByGatewayRefs(paymentId, razorpayOrderId);
  if (!order) {
    return { skipped: 'order_not_found' };
  }

  const sameRefs =
    order.razorpayPaymentId === paymentId && order.razorpayOrderId === razorpayOrderId;

  if (order.paymentStatus === 'PAID' && sameRefs) {
    return { idempotent: true, id: order.id, orderNumber: order.orderNumber };
  }

  if (
    order.paymentStatus === 'PAID' &&
    (
      (paymentId && order.razorpayPaymentId && order.razorpayPaymentId !== paymentId) ||
      (razorpayOrderId && order.razorpayOrderId && order.razorpayOrderId !== razorpayOrderId)
    )
  ) {
    return {
      conflict: 'payment_already_recorded_with_different_gateway_refs',
      id: order.id,
      orderNumber: order.orderNumber,
    };
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'PAID',
      razorpayPaymentId: paymentId || order.razorpayPaymentId,
      razorpayOrderId: razorpayOrderId || order.razorpayOrderId,
      status: order.status === 'PLACED' ? 'CONFIRMED' : order.status,
    },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      status: true,
      razorpayPaymentId: true,
      razorpayOrderId: true,
    },
  });

  return { ok: true, order: updated };
}

async function reconcileFailedPayment(payment: any) {
  const paymentId = asNonEmptyString(payment?.id);
  const razorpayOrderId = asNonEmptyString(payment?.order_id);
  const snapshotId = asNonEmptyString(payment?.notes?.snapshotId);

  const snapshot = await findSnapshotForGatewayRefs(snapshotId, razorpayOrderId);
  let snapshotResult: any = { skipped: 'snapshot_not_found' };

  if (snapshot) {
    if (snapshot.lastSeenStep === 'payment_failed') {
      snapshotResult = { idempotent: true, id: snapshot.id };
    } else {
      await prisma.abandonedCart.update({
        where: { id: snapshot.id },
        data: { lastSeenStep: 'payment_failed' } as any,
      });
      snapshotResult = { ok: true, id: snapshot.id };
    }
  }

  const order = await findOrderByGatewayRefs(paymentId, razorpayOrderId);
  if (!order) {
    return {
      snapshot: snapshotResult,
      order: { skipped: 'order_not_found' },
    };
  }

  if (order.paymentStatus === 'PAID') {
    return {
      snapshot: snapshotResult,
      order: {
        skipped: 'order_already_paid',
        id: order.id,
        orderNumber: order.orderNumber,
      },
    };
  }

  const sameRefs =
    (order.razorpayPaymentId || null) === (paymentId || null) &&
    (order.razorpayOrderId || null) === (razorpayOrderId || null);

  if (order.paymentStatus === 'FAILED' && sameRefs) {
    return {
      snapshot: snapshotResult,
      order: {
        idempotent: true,
        id: order.id,
        orderNumber: order.orderNumber,
      },
    };
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: 'FAILED',
      razorpayPaymentId: paymentId || order.razorpayPaymentId,
      razorpayOrderId: razorpayOrderId || order.razorpayOrderId,
    },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      razorpayPaymentId: true,
      razorpayOrderId: true,
    },
  });

  return {
    snapshot: snapshotResult,
    order: { ok: true, order: updated },
  };
}

async function reconcileRefundProcessed(refund: any, payment: any) {
  const refundId = asNonEmptyString(refund?.id);
  const paymentId =
    asNonEmptyString(refund?.payment_id) || asNonEmptyString(payment?.id);
  const razorpayOrderId = asNonEmptyString(payment?.order_id);
  const refundAmount = typeof refund?.amount === 'number' ? refund.amount : 0;

  const order = await findOrderByGatewayRefs(paymentId, razorpayOrderId);
  if (!order) {
    return {
      skipped: 'order_not_found',
      refundId,
      paymentId,
    };
  }

  const nextPaymentStatus =
    refundAmount > 0 && refundAmount < order.total
      ? 'PARTIALLY_REFUNDED'
      : 'REFUNDED';

  if (order.paymentStatus === nextPaymentStatus) {
    return {
      idempotent: true,
      id: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      refundId,
    };
  }

  if (order.paymentStatus === 'REFUNDED' && nextPaymentStatus === 'PARTIALLY_REFUNDED') {
    return {
      idempotent: true,
      id: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      refundId,
    };
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: nextPaymentStatus,
    },
    select: {
      id: true,
      orderNumber: true,
      paymentStatus: true,
      razorpayPaymentId: true,
      razorpayOrderId: true,
    },
  });

  return {
    ok: true,
    refundId,
    order: updated,
  };
}

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'RAZORPAY_WEBHOOK_SECRET not set' },
      { status: 503 }
    );
  }

  const signature = req.headers.get('x-razorpay-signature') || '';
  const raw = await req.text();

  if (!signature || !verifySignature(raw, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventName = asNonEmptyString(event?.event) || 'unknown';

  try {
    if (eventName === 'payment.captured') {
      const payment = event?.payload?.payment?.entity;
      if (!payment) {
        return NextResponse.json(
          { event: eventName, error: 'payment payload missing' },
          { status: 400 }
        );
      }

      const [feeResult, orderResult] = await Promise.all([
        recordGatewayFee(payment),
        reconcileCapturedPayment(payment),
      ]);

      return NextResponse.json({
        event: eventName,
        fee: feeResult,
        order: orderResult,
      });
    }

    if (eventName === 'payment.failed') {
      const payment = event?.payload?.payment?.entity;
      if (!payment) {
        return NextResponse.json(
          { event: eventName, error: 'payment payload missing' },
          { status: 400 }
        );
      }

      const result = await reconcileFailedPayment(payment);
      return NextResponse.json({
        event: eventName,
        result,
      });
    }

    if (eventName === 'refund.processed') {
      const refund = event?.payload?.refund?.entity;
      const payment = event?.payload?.payment?.entity;

      if (!refund) {
        return NextResponse.json(
          { event: eventName, error: 'refund payload missing' },
          { status: 400 }
        );
      }

      const result = await reconcileRefundProcessed(refund, payment);
      return NextResponse.json({
        event: eventName,
        result,
      });
    }

    return NextResponse.json({ event: eventName, ignored: true });
  } catch (err: any) {
    console.error('[razorpay.webhook]', err);
    return NextResponse.json(
      { error: err?.message || 'Server error', event: eventName },
      { status: 500 }
    );
  }
}
