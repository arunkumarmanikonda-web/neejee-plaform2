import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOrderNumber, calculateShipping, calculateGST } from '@/lib/utils';
import { getSession } from '@/lib/auth';
import { products } from '@/lib/data';

const CheckoutSchema = z.object({
  customer: z.object({
    email: z.string().email(),
    name: z.string().min(2),
    phone: z.string().min(10),
  }),
  address: z.object({
    line1: z.string().min(5),
    line2: z.string().optional(),
    city: z.string().min(2),
    state: z.string().min(2),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/, 'Invalid pincode'),
    country: z.string().default('IN'),
  }),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().int().positive(),
  })).min(1),
  payment: z.enum(['UPI', 'CARD', 'NB', 'COD']),
  giftWrap: z.boolean().optional(),
  personalNote: z.string().optional(),
  couponCode: z.string().optional(),
});

// In-memory order store for dev. Production: Prisma.
const orders: any[] = [];

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid order', details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const session = await getSession();

  // Validate stock + recalculate pricing server-side (never trust client prices)
  let subtotal = 0;
  for (const item of data.items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 400 });
    if (product.inventory < item.quantity) return NextResponse.json({ error: `${product.name} out of stock` }, { status: 400 });
    subtotal += product.sellingPrice * item.quantity;
  }
  if (data.giftWrap) subtotal += 15000;

  const shipping = calculateShipping(subtotal, data.address.pincode);
  const total = subtotal + shipping;
  const gstIncluded = calculateGST(total, 5);

  const orderNumber = generateOrderNumber();

  // RAZORPAY ORDER CREATION (production)
  // const Razorpay = require('razorpay');
  // const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  // const rzpOrder = await rzp.orders.create({
  //   amount: total,
  //   currency: 'INR',
  //   receipt: orderNumber,
  //   notes: { customer_email: data.customer.email },
  // });

  const order = {
    id: 'ord_' + Math.random().toString(36).slice(2, 10),
    orderNumber,
    userId: session?.id || null,
    guestEmail: data.customer.email,
    guestName: data.customer.name,
    items: data.items,
    address: data.address,
    subtotal: subtotal - (data.giftWrap ? 15000 : 0),
    giftWrap: data.giftWrap || false,
    personalNote: data.personalNote || null,
    shipping,
    tax: gstIncluded,
    total,
    paymentMethod: data.payment,
    paymentStatus: data.payment === 'COD' ? 'PENDING' : 'PENDING',
    status: 'PLACED',
    createdAt: new Date().toISOString(),
  };

  orders.push(order);

  // PRODUCTION SIDE EFFECTS
  // await prisma.order.create({ data: { ...order } });
  // await prisma.product.update({ where: { id }, data: { inventory: { decrement: qty } } });
  // await sendKlaviyoEvent('order_placed', { ...order });
  // await sendWhatsApp(data.customer.phone, 'order_confirmation', { orderNumber });
  // await shiprocket.create({ ... });

  console.log('[NEEJEE Order Placed]', orderNumber, 'Total:', total / 100);

  return NextResponse.json({
    success: true,
    orderNumber,
    total,
    razorpayOrderId: null,   // rzpOrder.id in production
    razorpayKey: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null,
    message: 'Order placed. Founder\'s note + authenticity card included in your Sandook.',
  });
}

export async function GET() {
  return NextResponse.json({ orders: orders.slice(-20).reverse() });
}
