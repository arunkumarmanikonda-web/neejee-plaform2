// Razorpay payment verification webhook
// Production flow:
//  1. Client receives razorpayOrderId from /api/checkout
//  2. Client opens Razorpay checkout with that orderId
//  3. On payment success, Razorpay returns: razorpay_payment_id, razorpay_order_id, razorpay_signature
//  4. Client POSTs these to this endpoint
//  5. We verify the signature, update Order.paymentStatus = 'PAID', trigger Shiprocket pickup
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderNumber } = await request.json();

  const secret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!secret) {
    console.warn('RAZORPAY_KEY_SECRET not set — accepting payment in dev mode');
    return NextResponse.json({ success: true, dev: true });
  }

  const generated = crypto
    .createHmac('sha256', secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (generated !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // PRODUCTION:
  // await prisma.order.update({
  //   where: { orderNumber },
  //   data: { paymentStatus: 'PAID', razorpayPaymentId: razorpay_payment_id, status: 'CONFIRMED' }
  // });
  // await triggerShiprocketPickup(orderNumber);
  // await sendWhatsApp(phone, 'payment_received', { orderNumber });

  return NextResponse.json({ success: true });
}
