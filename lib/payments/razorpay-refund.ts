type RazorpayRefund = {
  id?: string;
  status?: string;
  payment_id?: string;
  amount?: number;
};

type CheckoutRefundReason =
  | 'inventory_unavailable_after_hold'
  | 'coupon_unavailable_after_hold'
  | 'loyalty_unavailable_after_hold';

function refundIdempotencyKey(snapshotId: string, reason: CheckoutRefundReason): string {
  const safe = String(snapshotId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  if (reason === 'inventory_unavailable_after_hold') {
    // Preserve the original key format so retries across deployments remain idempotent.
    return `neejee_inv_${safe || 'unknown'}`;
  }
  const prefix = reason === 'coupon_unavailable_after_hold' ? 'cpn' : 'loy';
  return `neejee_${prefix}_${safe || 'unknown'}`;
}

export async function refundCapturedPayment({
  paymentId,
  snapshotId,
  reason,
}: {
  paymentId: string;
  snapshotId: string;
  reason: CheckoutRefundReason;
}): Promise<RazorpayRefund> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay refund credentials are not configured');
  }

  const credentials = Buffer.from(`${keyId}:${keySecret}`, 'utf8').toString('base64');
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'X-Refund-Idempotency': refundIdempotencyKey(snapshotId, reason),
      },
      body: JSON.stringify({
        notes: {
          reason,
          neejee_snapshot_id: snapshotId,
        },
      }),
      cache: 'no-store',
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[razorpay.refund] failed', {
      paymentId,
      snapshotId,
      reason,
      status: response.status,
      code: data?.error?.code,
    });
    throw new Error(`Razorpay refund request failed (${response.status})`);
  }

  return data as RazorpayRefund;
}

export async function refundPaymentForInventoryFailure({
  paymentId,
  snapshotId,
}: {
  paymentId: string;
  snapshotId: string;
}): Promise<RazorpayRefund> {
  return refundCapturedPayment({
    paymentId,
    snapshotId,
    reason: 'inventory_unavailable_after_hold',
  });
}
