// /api/admin/disputes/[id]/events
// POST - admin adds a comment / evidence to the dispute

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { commentOnDispute } from '@/lib/disputes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const ev = await commentOnDispute({
      disputeId: params.id,
      actorUserId: session.id,
      actorRole: 'ADMIN',
      body: body.body || '',
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    });
    return NextResponse.json({ ok: true, event: ev });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
