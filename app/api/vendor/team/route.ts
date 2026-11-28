// GET  /api/vendor/team       — list team members
// POST /api/vendor/team       — invite a new team member (email + access level)
// Only the vendor OWNER (role=VENDOR) can manage team members.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { inviteMember, InvitationError } from '@/lib/team-invitations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function ownerGate() {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') {
    return { error: 'Only the primary vendor user can manage the team', status: 403 };
  }
  const vendor = await prisma.vendor.findUnique({ where: { userId: session.id } });
  if (!vendor || ['SUSPENDED', 'ARCHIVED'].includes(vendor.status)) return { error: 'No vendor profile', status: 404 };
  return { session, vendor };
}

export async function GET() {
  const g = await ownerGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const members = await prisma.vendorTeamMember.findMany({
    where: { vendorId: g.vendor.id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true, image: true, passwordHash: true } } },
  });
  return NextResponse.json({
    members: members.map(m => ({
      id: m.id,
      email: m.email,
      displayName: m.displayName,
      accessLevel: m.accessLevel,
      status: m.status,
      invitedAt: m.invitedAt,
      acceptedAt: m.acceptedAt,
      hasPassword: !!m.user?.passwordHash,
    })),
  });
}

export async function POST(request: Request) {
  const g = await ownerGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  try {
    const body = await request.json();
    const member = await inviteMember('vendor', g.vendor.id, g.session.id, body);
    await prisma.vendorAuditLog.create({ data: { vendorId: g.vendor.id, actorUserId: g.session.id, actorRole: 'VENDOR', action: 'TEAM_MEMBER_INVITED', details: { memberId: member.id } } });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof InvitationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Unable to complete the invitation. Please retry.' }, { status: 503 });
  }
}
