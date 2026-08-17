type RazorpayRefund = {
  id?: string;
  status?: string;
  payment_id?: string;
  amount?: number;
};

function refundIdempotencyKey(snapshotId: string): string {
  const safe = String(snapshotId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  return `neejee_inv_${safe || 'unknown'}`;
}

export async function refundPaymentForInventoryFailure({
  paymentId,
  snapshotId,
}: {
  paymentId: string;
  snapshotId: string;
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
        'X-Refund-Idempotency': refundIdempotencyKey(snapshotId),
      },
      body: JSON.stringify({
        notes: {
          reason: 'inventory_unavailable_after_hold',
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
      status: response.status,
      code: data?.error?.code,
    });
    throw new Error(`Razorpay refund request failed (${response.status})`);
  }

  return data as RazorpayRefund;
}
