// Admin single order endpoint - GET detail, PATCH status
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { sendEmail, orderShippedEmail, orderDeliveredEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_STATUSES = ['PLACED','CONFIRMED','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Allow lookup by orderNumber OR id
    const order = await prisma.order.findFirst({
      where: { OR: [{ orderNumber: params.id }, { id: params.id }] },
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
        address: true,
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true, sku: true, images: true } },
            variant: { select: { id: true, size: true, color: true } },
          },
        },
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { status, trackingUrl, awbNumber, courier } = body;
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    const existing = await prisma.order.findFirst({
      where: { OR: [{ orderNumber: params.id }, { id: params.id }] },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === 'SHIPPED') data.shippedAt = new Date();
      if (status === 'DELIVERED') data.deliveredAt = new Date();
    }
    if (trackingUrl !== undefined) data.trackingUrl = trackingUrl;
    if (awbNumber !== undefined) data.awbNumber = awbNumber;
    if (courier !== undefined) data.courier = courier;

    const updated = await prisma.order.update({
      where: { id: existing.id },
      data,
      include: { user: true },
    });

    // v23.40.9 — Auto-post to revenue ledger on CONFIRMED or DELIVERED.
    // Idempotent (SalesInvoice.orderId unique). COD orders typically become
    // PAID when delivered, so DELIVERED is the more reliable hook for COD.
    if (status === 'CONFIRMED' || status === 'DELIVERED') {
      try {
        const { postOrderToInvoice } = await import('@/lib/finance/post-order');
        await postOrderToInvoice(updated.id, user!.id);
      } catch (e: any) {
        console.warn('[order PATCH] revenue posting failed:', e?.message);
      }
    }

    // v23.40.12 — Auto-reverse revenue ledger on REFUNDED / CANCELLED.
    // Posts negative mirror RevenueEntries + negative SalesInvoicePayment so
    // the customer ledger reflects the refund. Idempotent on invoice.paymentStatus.
    if (status === 'REFUNDED' || status === 'CANCELLED') {
      try {
        const { reverseOrderRevenue } = await import('@/lib/finance/reverse-order');
        // Pull the invoice total so we can refund the full amount
        const inv = await prisma.salesInvoice.findUnique({
          where: { orderId: updated.id },
          select: { totalPaise: true, paidPaise: true },
        });
        if (inv && inv.paidPaise > 0) {
          await reverseOrderRevenue({
            orderId: updated.id,
            refundAmountPaise: inv.paidPaise,        // refund what was actually collected
            proportionReversed: 1,                    // full reversal
            reason: status,                            // 'REFUNDED' or 'CANCELLED'
            postedByUserId: user!.id,
          });
        }
      } catch (e: any) {
        console.warn('[order PATCH] revenue reversal failed:', e?.message);
      }
    }

    // Auto-create GST e-invoice row on CONFIRMED (B2B only). Idempotent via
    // unique orderId. B2C is marked EXEMPT so the finance team can see it but
    // doesn't need to file an IRN.
    if (status === 'CONFIRMED') {
      try {
        const existingEi = await prisma.gstEInvoice.findUnique({
          where: { orderId: updated.id },
        });
        if (!existingEi) {
          await prisma.gstEInvoice.create({
            data: {
              orderId: updated.id,
              status: updated.gstinCustomer ? 'PENDING' : 'EXEMPT',
              payload: { autoQueued: true, queuedAt: new Date().toISOString() },
            },
          });
        }
      } catch (e: any) {
        console.warn('[order PATCH] gst e-invoice queue failed:', e?.message);
      }
    }

    // Unified notification on status change. Routes through the engine —
    // logs, respects user preferences, fans out across configured channels.
    if (status && ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'CONFIRMED'].includes(status)) {
      try {
        const { notify } = await import('@/lib/notifications');
        const eventMap: Record<string, any> = {
          SHIPPED:   'ORDER_SHIPPED',
          DELIVERED: 'ORDER_DELIVERED',
          CANCELLED: 'ORDER_CANCELLED',
          REFUNDED:  'ORDER_REFUNDED',
          CONFIRMED: 'ORDER_CONFIRMED',
        };
        const recipientEmail = updated.user?.email || updated.guestEmail;
        const recipients = updated.userId
          ? { userId: updated.userId }
          : recipientEmail ? { recipients: [{ email: recipientEmail }] } : null;
        if (recipients) {
          // v23.37.2: include phone for SMS (defensive string cast)
          const rawPhone = (updated as any).guestPhone || (updated.user as any)?.phone;
          const phoneStr: string = rawPhone ? String(rawPhone) : '';
          if (!updated.userId && phoneStr && (recipients as any).recipients) {
            (recipients as any).recipients[0].phone = phoneStr;
          }
          // Build SMS vars matching each DLT template's varOrder
          const smsVarsByEvent: Record<string, Record<string, string>> = {
            ORDER_SHIPPED: {
              orderNumber: updated.orderNumber,
              courier: updated.courier || 'courier',
              tracking: updated.awbNumber || updated.trackingUrl || 'see email',
            },
            ORDER_DELIVERED: { orderNumber: updated.orderNumber },
            ORDER_CANCELLED: { orderNumber: updated.orderNumber },
            ORDER_CONFIRMED: { orderNumber: updated.orderNumber },
            ORDER_REFUNDED: {
              amount: Math.round((updated.total || 0) / 100).toString(),
              orderNumber: updated.orderNumber,
            },
          };
          notify({
            event: eventMap[status],
            ...recipients,
            data: {
              orderNumber: updated.orderNumber,
              trackingNumber: updated.awbNumber,
              trackingUrl: updated.trackingUrl,
              courier: updated.courier,
              amountPaise: updated.total,
            },
            context: {
              type: 'ORDER',
              id: updated.id,
              smsVars: smsVarsByEvent[eventMap[status]] || {},
            } as any,
          }).catch(e => console.warn('[notify order]', e?.message));
        }
      } catch (e: any) {
        console.warn('[order PATCH] notify failed:', e?.message);
      }
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
