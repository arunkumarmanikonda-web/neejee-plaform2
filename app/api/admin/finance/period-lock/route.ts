// v23.40.5 — Period Lock (monthly close)
// GET    /api/admin/finance/period-lock        — list all locked months
// POST   /api/admin/finance/period-lock        — lock a month   body: { monthBucket, notes? }
// DELETE /api/admin/finance/period-lock?monthBucket=YYYY-MM  — unlock (super admin only)

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { recordAudit } from '@/lib/finance/audit-log';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const locks = await prisma.periodLock.findMany({ orderBy: { monthBucket: 'desc' } });
  return NextResponse.json({ locks });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.approve');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const { monthBucket, notes } = body;
  if (!monthBucket || !/^\d{4}-\d{2}$/.test(monthBucket)) {
    return NextResponse.json({ error: 'monthBucket must be YYYY-MM' }, { status: 400 });
  }
  const lock = await prisma.periodLock.upsert({
    where: { monthBucket },
    update: { notes: notes || null, lockedAt: new Date(), lockedByUserId: session!.id },
    create: {
      id: 'lock_' + randomBytes(8).toString('hex'),
      monthBucket,
      lockedByUserId: session!.id,
      notes: notes || null,
    },
  });
  await recordAudit({
    action: 'CREATE', entityType: 'PeriodLock', entityId: lock.id,
    after: lock, session, req,
  });
  return NextResponse.json({ lock });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.approve');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const monthBucket = url.searchParams.get('monthBucket');
  if (!monthBucket) return NextResponse.json({ error: 'monthBucket required' }, { status: 400 });

  const before = await prisma.periodLock.findUnique({ where: { monthBucket } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.periodLock.delete({ where: { monthBucket } });
  await recordAudit({
    action: 'DELETE', entityType: 'PeriodLock', entityId: before.id,
    before, session, req,
  });
  return NextResponse.json({ ok: true });
}
