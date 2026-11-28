import { inviteMember, InvitationError } from '@/lib/team-invitations';
// Seller team management — list + invite.
// GET  /api/seller/team
// POST /api/seller/team  body: { email, displayName?, accessLevel }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext, canManageAccount } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  if (!canManageAccount(gate.ctx)) return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
  try {
    const members = await prisma.sellerTeamMember.findMany({
      where: { sellerId: gate.ctx.seller.id, status: { not: 'REMOVED' } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ members });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!canManageAccount(gate.ctx) || gate.ctx.seller.kycStatus !== 'APPROVED') return NextResponse.json({ error: 'Approved owner access required.' }, { status: 403 });
  try {
    const body = await request.json();
    const member = await inviteMember('seller', gate.ctx.seller.id, session!.id, body);
    await prisma.sellerAuditLog.create({ data: { sellerId: gate.ctx.seller.id, actorUserId: session!.id, actorRole: gate.ctx.actorRole, action: 'TEAM_INVITED', details: { memberId: member.id } } });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    if (error instanceof InvitationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Unable to complete the invitation. Please retry.' }, { status: 503 });
  }
}
