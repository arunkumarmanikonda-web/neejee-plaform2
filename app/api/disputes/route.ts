// /api/disputes
// Customer-facing endpoint: raise a dispute on one of their orders, list own disputes.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { openDispute, commentOnDispute } from '@/lib/disputes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await prisma.dispute.findMany({
    where: { customerUserId: session.id, resourceType: 'ORDER' },
    orderBy: { createdAt: 'desc' },
    include: { order: { select: { orderNumber: true } } },
    take: 100,
  });
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const orderId = String(body.orderId || '').trim();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
    // Verify ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });
    if (!order || order.userId !== session.id) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const dispute = await openDispute({
      resourceType: 'ORDER',
      orderId,
      raisedByUserId: session.id,
      raisedByRole: 'CUSTOMER',
      category: body.category || 'OTHER',
      severity: body.severity || 'MEDIUM',
      title: body.title || 'Issue with order',
      description: body.description || '',
      evidenceUrls: Array.isArray(body.evidenceUrls) ? body.evidenceUrls : [],
    });
    return NextResponse.json({ ok: true, dispute });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

// Customer adds a follow-up comment to their dispute
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const disputeId = String(body.disputeId || '').trim();
    if (!disputeId) return NextResponse.json({ error: 'disputeId required' }, { status: 400 });
    const d = await prisma.dispute.findUnique({ where: { id: disputeId }, select: { customerUserId: true } });
    if (!d || d.customerUserId !== session.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const ev = await commentOnDispute({
      disputeId,
      actorUserId: session.id,
      actorRole: 'CUSTOMER',
      body: body.body || '',
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });
    return NextResponse.json({ ok: true, event: ev });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
