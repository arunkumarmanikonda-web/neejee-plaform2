// PATCH /api/vendor/team/[id] — change access level / status
// DELETE /api/vendor/team/[id] — remove (soft, status=REMOVED)
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function ownerGate() {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') return { error: 'Only primary vendor user', status: 403 };
  const vendor = await prisma.vendor.findUnique({ where: { userId: session.id } });
  if (!vendor) return { error: 'No vendor', status: 404 };
  return { session, vendor };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const g = await ownerGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: any = {};
  try { body = await request.json(); } catch {}

  const member = await prisma.vendorTeamMember.findFirst({
    where: { id: params.id, vendorId: g.vendor.id },
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data: Record<string, any> = {};
  if (body.accessLevel && ['FULL', 'FINANCE_ONLY', 'OPERATIONS_ONLY'].includes(body.accessLevel)) {
    data.accessLevel = body.accessLevel;
  }
  if (body.status && ['ACTIVE', 'SUSPENDED'].includes(body.status)) {
    data.status = body.status;
  }
  if (body.displayName !== undefined) data.displayName = body.displayName;

  const updated = await prisma.vendorTeamMember.update({ where: { id: member.id }, data });
  await prisma.vendorAuditLog.create({
    data: {
      vendorId: g.vendor.id,
      actorUserId: g.session.id,
      actorRole: 'VENDOR',
      action: 'TEAM_MEMBER_UPDATED',
      details: { teamMemberId: member.id, changes: data },
    },
  });
  return NextResponse.json({ member: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await ownerGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const member = await prisma.vendorTeamMember.findFirst({
    where: { id: params.id, vendorId: g.vendor.id },
  });
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.vendorTeamMember.update({
    where: { id: member.id },
    data: { status: 'REMOVED' },
  });
  await prisma.vendorAuditLog.create({
    data: {
      vendorId: g.vendor.id,
      actorUserId: g.session.id,
      actorRole: 'VENDOR',
      action: 'TEAM_MEMBER_REMOVED',
      details: { teamMemberId: member.id, email: member.email },
    },
  });
  return NextResponse.json({ ok: true });
}
