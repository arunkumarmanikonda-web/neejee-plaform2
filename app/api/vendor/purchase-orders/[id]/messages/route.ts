// /api/vendor/purchase-orders/[id]/messages
// Vendor-portal endpoint: list & post messages on PO they belong to.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { postPoMessage, markPoMessagesRead } from '@/lib/po-messages';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VENDOR_ROLES = ['VENDOR', 'VENDOR_STAFF'];

async function resolveVendor(poId: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (!VENDOR_ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  const vendor = await prisma.vendor.findFirst({ where: { userId: session.id } });
  if (!vendor) return { error: NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 }) } as const;
  // Verify the PO belongs to this vendor
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    select: { id: true, vendorId: true },
  });
  if (!po || po.vendorId !== vendor.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  }
  return { session, vendor } as const;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await resolveVendor(params.id);
  if ('error' in r) return r.error;
  const messages = await prisma.poMessage.findMany({
    where: { purchaseOrderId: params.id },
    orderBy: { createdAt: 'asc' },
  });
  await markPoMessagesRead(params.id, 'vendor');
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await resolveVendor(params.id);
  if ('error' in r) return r.error;
  try {
    const body = await req.json();
    const user = await prisma.user.findUnique({
      where: { id: r.session.id },
      select: { name: true, email: true },
    });
    const msg = await postPoMessage({
      purchaseOrderId: params.id,
      authorUserId: r.session.id,
      authorRole: r.session.role === 'VENDOR_STAFF' ? 'VENDOR_STAFF' : 'VENDOR',
      authorName: user?.name || user?.email || r.vendor.legalName || 'Vendor',
      body: body.body || '',
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });
    return NextResponse.json({ ok: true, message: msg });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
