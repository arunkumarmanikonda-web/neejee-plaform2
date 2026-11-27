import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canReadReturnOrder, RETURN_COOKIE } from '@/lib/returns/guest-access';
import { availableReasons, CUSTOMER_UPDATE_PREFIX, readReturnRequest, RETURN_REASONS, returnCaseId } from '@/lib/returns/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ orderNumber: string }> };
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const hidden = () => json({ error: 'Open the order in your account or look it up again.' }, 404);

function sameOrigin(req: NextRequest) {
  if (req.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = req.headers.get('origin');
  if (!origin || origin === req.nextUrl.origin) return true;
  // Next can reconstruct its internal URL with localhost on a trusted reverse proxy.
  // The incoming Host retains the actual public host, including a development port.
  try {
    const source = new URL(origin);
    const protocol = (req.headers.get('x-forwarded-proto')?.split(',')[0] || req.nextUrl.protocol).trim().replace(/:$/, '');
    return source.host === req.headers.get('host') && source.protocol === protocol + ':';
  } catch { return false; }
}


async function buyerOrder(req: NextRequest, number: string) {
  if (!number || number.length > 80) return null;
  const [session, order] = await Promise.all([
    getSession(),
    prisma.order.findUnique({
      where: { orderNumber: number },
      select: {
        id: true, userId: true, status: true,
        items: { select: {
          id: true, productId: true, variantId: true, quantity: true,
          variant: { select: { sku: true, color: true, size: true } },
          product: { select: { name: true, returnEligible: true, returnPolicy: true, sellerId: true } },
        } },
      },
    }),
  ]);
  if (!order || !canReadReturnOrder(order, session?.id, req.cookies.get(RETURN_COOKIE)?.value)) return null;
  return order;
}

export async function GET(req: NextRequest, props: Context) {
  const params = await props.params;
  const order = await buyerOrder(req, params.orderNumber);
  if (!order) return hidden();
  const cases = await prisma.dispute.findMany({
    where: { orderId: order.id, resourceType: 'ORDER', id: { in: order.items.map(line => returnCaseId(line.id)) } },
    select: { id: true, status: true, resolutionNote: true, events: {
      where: { type: 'COMMENT', OR: [ { actorRole: 'CUSTOMER' }, { actorRole: 'ADMIN', body: { startsWith: CUSTOMER_UPDATE_PREFIX } } ] },
      orderBy: { createdAt: 'desc' }, take: 20, select: { actorRole: true, body: true },
    } },
  });
  return json({
    status: order.status,
    items: order.items.map(line => {
      const dispute = cases.find(entry => entry.id === returnCaseId(line.id));
      return {
        id: line.id, name: line.product.name, variant: [line.variant?.color, line.variant?.size].filter(Boolean).join(' · '),
        quantity: line.quantity, policy: line.product.returnPolicy, reasons: availableReasons(order.status, line.product.returnEligible),
        request: dispute ? { reference: dispute.id, status: dispute.status,
          customerReply: dispute.events.find(event => event.actorRole === 'CUSTOMER')?.body || null,
          message: dispute.status === 'RESOLVED' ? dispute.resolutionNote : dispute.events.find(event => event.actorRole === 'ADMIN')?.body?.slice(CUSTOMER_UPDATE_PREFIX.length) || null } : null,
      };
    }),
  });
}

export async function POST(req: NextRequest, props: Context) {
  const params = await props.params;
  if (!sameOrigin(req)) {
    return json({ error: 'Open this order in the store to send a request.' }, 403);
  }
  const order = await buyerOrder(req, params.orderNumber);
  if (!order) return hidden();
  const input = readReturnRequest(await req.json().catch(() => null));
  if (!input) return json({ error: 'Check the piece, quantity and reason.' }, 400);
  const line = order.items.find(item => item.id === input.itemId);
  if (!line) return hidden();
  const id = returnCaseId(line.id);
  const existing = () => prisma.dispute.findFirst({ where: { id, orderId: order.id }, select: { id: true, status: true } });
  const first = await existing();
  if (first) return json({ request: first });
  if (input.quantity > line.quantity || !availableReasons(order.status, line.product.returnEligible).includes(input.reason)) {
    return json({ error: 'This request is unavailable for that piece, quantity or delivery status.' }, 409);
  }
  const category = input.reason === 'RETURN' ? 'OTHER' : input.reason;
  const title = `${RETURN_REASONS[input.reason]} · ${line.product.name}`.slice(0, 200);
  const actor = order.userId ?? `guest:${order.id}`;
  const description = [
    `${input.quantity} of ${line.quantity} ordered · ${line.product.name}`,
    `Order line ${line.id} · ${line.variant?.sku || line.productId}`,
    `Listed policy at request: ${line.product.returnPolicy || (line.product.returnEligible ? 'Return-eligible' : 'Standard returns excluded')}`,
    input.note,
  ].filter(Boolean).join('\n');
  try {
    const request = await prisma.dispute.create({
      data: {
        id, resourceType: 'ORDER', orderId: order.id, customerUserId: order.userId, sellerId: line.product.sellerId,
        raisedByUserId: actor, raisedByRole: 'CUSTOMER', category, severity: 'MEDIUM', status: 'OPEN',
        title, description, dueBy: new Date(Date.now() + 72 * 60 * 60 * 1000),
        events: { create: { type: 'CREATED', actorUserId: actor, actorRole: 'CUSTOMER', body: title, toStatus: 'OPEN' } },
      },
      select: { id: true, status: true },
    });
    return json({ request }, 201);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const request = await existing();
      if (request) return json({ request });
    }
    throw error;
  }
}

export async function PATCH(req: NextRequest, props: Context) {
  const params = await props.params;
  if (!sameOrigin(req)) {
    return json({ error: 'Open this order in the store to send a reply.' }, 403);
  }
  const order = await buyerOrder(req, params.orderNumber);
  if (!order) return hidden();
  const input = await req.json().catch(() => null);
  const message = typeof input?.message === 'string' ? input.message.trim() : '';
  if (!message || message.length > 2000 || typeof input?.itemId !== 'string' ||
      typeof input?.replyId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.replyId)) {
    return json({ error: 'Write a reply of up to 2,000 characters.' }, 400);
  }
  const line = order.items.find(item => item.id === input.itemId);
  if (!line) return hidden();
  const id = returnCaseId(line.id);
  const result = await prisma.$transaction(async tx => {
    // Lock this case while verifying it is open, so resolution and a late reply cannot cross.
    const locked = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM "Dispute" WHERE id = ${id} AND "orderId" = ${order.id} FOR UPDATE`;
    if (!locked.length) return 'missing';
    const replyId = `${id}-reply-${input.replyId}`;
    const previous = await tx.disputeEvent.findUnique({ where: { id: replyId }, select: { body: true } });
    if (previous) return previous.body === message ? 'sent' : 'closed';
    if (['REJECTED', 'RESOLVED', 'WITHDRAWN'].includes(locked[0].status)) return 'closed';
    await tx.disputeEvent.create({ data: {
      id: replyId, disputeId: id, actorUserId: order.userId ?? `guest:${order.id}`,
      actorRole: 'CUSTOMER', type: 'COMMENT', body: message,
    } });
    if (locked[0].status === 'AWAITING_CUSTOMER') {
      await tx.dispute.update({ where: { id }, data: { status: 'UNDER_REVIEW' } });
      await tx.disputeEvent.create({ data: { disputeId: id, type: 'STATUS_CHANGED',
        actorUserId: order.userId ?? `guest:${order.id}`, actorRole: 'CUSTOMER',
        fromStatus: 'AWAITING_CUSTOMER', toStatus: 'UNDER_REVIEW', body: 'Customer replied' } });
    }
    return 'sent';
  });
  if (result === 'missing') return hidden();
  if (result === 'closed') return json({ error: 'This reply could not be added. Refresh the request or contact the team.' }, 409);
  return json({ sent: true });
}
