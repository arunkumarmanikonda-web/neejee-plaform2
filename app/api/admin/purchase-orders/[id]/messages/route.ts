// /api/admin/purchase-orders/[id]/messages
// GET  - list messages on a PO + mark read by admin
// POST - admin posts a new message (notifies vendor)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { postPoMessage, markPoMessagesRead } from '@/lib/po-messages';

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
  const messages = await prisma.poMessage.findMany({
    where: { purchaseOrderId: params.id },
    orderBy: { createdAt: 'asc' },
  });
  await markPoMessagesRead(params.id, 'admin');
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const user = await prisma.user.findUnique({
      where: { id: g.session!.id },
      select: { name: true, email: true },
    });
    const msg = await postPoMessage({
      purchaseOrderId: params.id,
      authorUserId: g.session!.id,
      authorRole: g.session!.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
      authorName: user?.name || user?.email || 'Admin',
      body: body.body || '',
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });
    return NextResponse.json({ ok: true, message: msg });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
