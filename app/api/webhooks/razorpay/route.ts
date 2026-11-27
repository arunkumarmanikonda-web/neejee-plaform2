import { razorpayCredentials } from '@/lib/payments/razorpay-credentials';
// Razorpay webhook handler.
//
// Configure on https://dashboard.razorpay.com/app/webhooks:
//   URL:    https://www.neejee.com/api/webhooks/razorpay
//   Secret: <value> → set as RAZORPAY_WEBHOOK_SECRET in Vercel env
//   Events: payment.captured, payment.failed, refund.processed
//
// Webhook responsibilities:
//   - Verify Razorpay webhook signature
//   - Reconcile payment/refund status onto existing rows
//   - Recover snapshot-based prepaid checkout if the browser never reaches
//     /api/razorpay/verify after a successful capture
//   - Ingest gateway fee idempotently on payment.captured
//
// Snapshot recovery deliberately reuses /api/razorpay/verify rather than
// duplicating its atomic inventory/coupon/loyalty/order/refund logic.

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { captureState, fetchRefundedPaise } from '@/lib/payments/razorpay-settlement';
import { POST as verifyCheckout } from '@/app/api/razorpay/verify/route';
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
    if (byId && (!razorpayOrderId || byId.razorpayOrderId===razorpayOrderId)) return byId;
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

  if (!paymentId || !razorpayOrderId || order.razorpayOrderId !== razorpayOrderId ||
      captureState(payment,paymentId,razorpayOrderId,order.total)!=='captured') {
    return {conflict:'captured_payment_details_mismatch',id:order.id};
  }
  if (['PAID','REFUNDED','PARTIALLY_REFUNDED'].includes(order.paymentStatus)) {
    return order.razorpayPaymentId === paymentId
      ? {idempotent:true,id:order.id}
      : {conflict:'different_settled_payment',id:order.id};
  }
  if (['CANCELLED','CANCELLED_BUG','REFUNDED','RETURNED'].includes(order.status)) {
    return {conflict:'captured_payment_for_closed_order',id:order.id};
  }
  const changed = await prisma.$transaction(async tx => {
    const changed = await tx.order.updateMany({
      where:{id:order.id,razorpayOrderId,paymentStatus:{in:['PENDING','FAILED']},status:{notIn:['CANCELLED','CANCELLED_BUG','REFUNDED','RETURNED']}},
      data:{paymentStatus:'PAID',razorpayPaymentId:paymentId},
    });
    if (changed.count) await tx.order.updateMany({where:{id:order.id,status:'PLACED'},data:{status:'CONFIRMED'}});
    return changed;
  });
  return {ok:true,id:order.id,idempotent:!changed.count};
}

async function recoverCapturedSnapshot(payment: any, requestUrl: string) {
  const snapshotId = asNonEmptyString(payment?.notes?.snapshotId);
  const paymentId = asNonEmptyString(payment?.id);
  const razorpayOrderId = asNonEmptyString(payment?.order_id);

  // Checkout notes may remain on the gateway order instead of the payment.
  // The gateway order ID persisted before checkout is the authoritative binding.
  if (!paymentId || !razorpayOrderId) {
    return { skipped: 'snapshot_gateway_refs_missing' };
  }

  const snapshot = await findSnapshotForGatewayRefs(snapshotId, razorpayOrderId);
  if (!snapshot) return { skipped: 'snapshot_not_found' };

  if (snapshot.razorpayOrderId !== razorpayOrderId) {
    return {
      conflict: 'snapshot_gateway_order_mismatch',
      snapshotId: snapshot.id,
    };
  }

  await prisma.abandonedCart.update({
    where: { id: snapshot.id },
    data: {
      lastSeenStep: 'payment_captured_webhook_reconciling',
      telecallerStatus: 'payment_reconciliation',
      telecallerNotes: `Captured payment ${paymentId} received by Razorpay webhook; automatic order finalization started.`,
    } as any,
  });

  const { keySecret } = razorpayCredentials();
  if (!keySecret) {
    await prisma.abandonedCart.update({
      where: { id: snapshot.id },
      data: {
        lastSeenStep: 'payment_captured_reconciliation_blocked',
        telecallerStatus: 'urgent_payment_exception',
        telecallerNotes: `Captured payment ${paymentId} requires reconciliation because RAZORPAY_KEY_SECRET is unavailable.`,
      } as any,
    }).catch(() => {});
    throw new Error('RAZORPAY_KEY_SECRET unavailable for captured snapshot reconciliation');
  }

  const checkoutSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest('hex');
  const verifyUrl = new URL('/api/razorpay/verify', requestUrl).toString();

  let response: Response;
  try {
    response = await verifyCheckout(new Request(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-NEEJEE-Reconcile-Source': 'razorpay-webhook',
      },
      body: JSON.stringify({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: checkoutSignature,
        snapshotId: snapshot.id,
      }),
      cache: 'no-store',
    }));
  } catch (error: any) {
    await prisma.abandonedCart.update({
      where: { id: snapshot.id },
      data: {
        lastSeenStep: 'payment_captured_reconciliation_retry',
        telecallerStatus: 'payment_reconciliation',
        telecallerNotes: `Captured payment ${paymentId}; automatic finalization transport failed and will retry via webhook.`,
      } as any,
    }).catch(() => {});
    throw new Error(`Captured snapshot finalization transport failed: ${error?.message || 'unknown error'}`);
  }

  const result = await response.json().catch(() => ({}));

  if (result?.code==='PAYMENT_CAPTURE_PENDING') throw new Error('Capture verification pending; retry webhook.');
  // 409 from the verifier can be the intentional, already-initiated integrity
  // refund path. Acknowledge the gateway event rather than repeatedly asking
  // Razorpay to deliver the same capture event.
  if (response.ok || (response.status === 409 && String(result?.code || '').startsWith('PAYMENT_REFUNDED_'))) {
    return {
      ok: response.ok,
      snapshotId: snapshot.id,
      status: response.status,
      code: result?.code || null,
      orderNumber: result?.order?.orderNumber || null,
      idempotent: !!result?.idempotent,
    };
  }

  await prisma.abandonedCart.update({
    where: { id: snapshot.id },
    data: {
      lastSeenStep:
        response.status >= 500
          ? 'payment_captured_reconciliation_retry'
          : 'payment_captured_reconciliation_exception',
      telecallerStatus:
        response.status >= 500 ? 'payment_reconciliation' : 'urgent_payment_exception',
      telecallerNotes: `Captured payment ${paymentId}; verifier returned ${response.status} (${result?.code || result?.error || 'unknown'}).`,
    } as any,
  }).catch(() => {});

  if (response.status >= 500) {
    throw new Error(`Captured snapshot finalization returned ${response.status}`);
  }

  return {
    error: 'snapshot_finalization_rejected',
    snapshotId: snapshot.id,
    status: response.status,
    code: result?.code || null,
  };
}

async function reconcileFailedPayment(payment: any) {
  const paymentId = asNonEmptyString(payment?.id);
  const razorpayOrderId = asNonEmptyString(payment?.order_id);
  const snapshotId = asNonEmptyString(payment?.notes?.snapshotId);

  const snapshot = await findSnapshotForGatewayRefs(snapshotId, razorpayOrderId);
  let snapshotResult: any = { skipped: 'snapshot_not_found' };

  if (snapshot && !snapshot.recoveredOrderId && snapshot.razorpayOrderId===razorpayOrderId) {
    if (snapshot.lastSeenStep === 'payment_failed') {
      snapshotResult = { idempotent: true, id: snapshot.id };
    } else {
      await prisma.abandonedCart.updateMany({
        where: { id: snapshot.id, recoveredOrderId:null, razorpayOrderId },
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

  if (!razorpayOrderId || !paymentId || order.razorpayOrderId!==razorpayOrderId) {
    return {snapshot:snapshotResult,order:{skipped:'gateway_order_mismatch'}};
  }
  const changed=await prisma.order.updateMany({
    where:{id:order.id,razorpayOrderId,paymentStatus:{in:['PENDING','FAILED']}},
    data:{paymentStatus:'FAILED',razorpayPaymentId:paymentId},
  });
  return {snapshot:snapshotResult,order:{id:order.id,changed:!!changed.count}};
}

async function reconcileRefundProcessed(refund: any, payment: any) {
  const refundId = asNonEmptyString(refund?.id);
  const paymentId =
    asNonEmptyString(refund?.payment_id) || asNonEmptyString(payment?.id);
  const razorpayOrderId = asNonEmptyString(payment?.order_id);
  if (!refundId || !paymentId || refund?.status!=='processed') return {skipped:'missing_processed_refund'};
  const order = await findOrderByGatewayRefs(paymentId,razorpayOrderId);
  if (!order || order.razorpayPaymentId!==paymentId) return {skipped:'settled_payment_not_found'};
  if (order.paymentStatus === 'REFUNDED') return {idempotent:true,id:order.id};
  const total=await fetchRefundedPaise(paymentId,refund);
  if (total<=0 || total>order.total) throw new Error('Refund total outside order amount');
  const full=total===order.total;
  const updated=await prisma.order.updateMany({
    where:{id:order.id,razorpayPaymentId:paymentId,paymentStatus:full?{not:'REFUNDED'}:{in:['PENDING','FAILED','PAID']}},
    data:{paymentStatus:full?'REFUNDED':'PARTIALLY_REFUNDED'},
  });
  return {ok:true,refundId,id:order.id,idempotent:!updated.count};
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

      const snapshotResult =
        (orderResult as any)?.skipped === 'order_not_found'
          ? await recoverCapturedSnapshot(payment, req.url)
          : { skipped: 'existing_order_reconciled' };

      return NextResponse.json({
        event: eventName,
        fee: feeResult,
        order: orderResult,
        snapshot: snapshotResult,
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
      { error: 'Webhook processing failed', event: eventName },
      { status: 500 }
    );
  }
}
