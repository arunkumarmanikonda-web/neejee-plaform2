import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'];

function socialDbAvailable(db: any) {
  return typeof db?.socialConnection?.update === 'function';
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const connectionId = (body?.connectionId || '').toString();
  if (!connectionId) {
    return NextResponse.json({ error: 'connectionId required' }, { status: 400 });
  }

  const db = prisma as any;
  if (!socialDbAvailable(db)) {
    return NextResponse.json({
      ok: false,
      degraded: true,
      error: 'Meta social connection tables are not available in this deployment yet.',
    }, { status: 503 });
  }

  const updated = await db.socialConnection.update({
    where: { id: connectionId },
    data: {
      status: 'DISCONNECTED',
      lastError: null,
    },
  });

  return NextResponse.json({ ok: true, connection: updated, degraded: false });
}
