// /api/admin/disputes/[id]
// GET   - detail + event timeline
// PATCH - change status / resolve

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { changeDisputeStatus } from '@/lib/disputes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

async function gate() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;
  const dispute = await prisma.dispute.findUnique({
    where: { id: params.id },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      order: { select: { id: true, orderNumber: true, total: true, status: true } },
      purchaseOrder: { select: { id: true, poNumber: true, status: true } },
    },
  });
  if (!dispute) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let vendor: any = null;
  let customer: any = null;
  if (dispute.vendorId) {
    vendor = await prisma.vendor.findUnique({
      where: { id: dispute.vendorId },
      select: { id: true, legalName: true, contactEmail: true },
    });
  }
  if (dispute.customerUserId) {
    customer = await prisma.user.findUnique({
      where: { id: dispute.customerUserId },
      select: { id: true, name: true, email: true },
    });
  }

  return NextResponse.json({ dispute, vendor, customer });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const updated = await changeDisputeStatus({
      disputeId: params.id,
      actorUserId: g.session!.id,
      actorRole: 'ADMIN',
      toStatus: body.toStatus,
      note: body.note,
      resolutionAmountPaise: body.resolutionAmountPaise,
    });
    return NextResponse.json({ ok: true, dispute: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
