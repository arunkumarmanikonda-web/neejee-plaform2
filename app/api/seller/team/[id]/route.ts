// Update or remove a team member.
// PATCH body: { accessLevel?, status? }
// DELETE = soft-remove (status=REMOVED)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext, canManageAccount } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!canManageAccount(gate.ctx)) {
    return NextResponse.json({ error: 'Only the studio owner can edit team members' }, { status: 403 });
  }

  try {
    const member = await prisma.sellerTeamMember.findUnique({ where: { id: params.id } });
    if (!member || member.sellerId !== gate.ctx.seller.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { accessLevel, status } = await req.json();
    const updated = await prisma.sellerTeamMember.update({
      where: { id: params.id },
      data: {
        ...(accessLevel ? { accessLevel: accessLevel as any } : {}),
        ...(status ? { status: status as any } : {}),
      },
    });
    return NextResponse.json({ member: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!canManageAccount(gate.ctx)) {
    return NextResponse.json({ error: 'Only the studio owner can remove team members' }, { status: 403 });
  }

  try {
    const member = await prisma.sellerTeamMember.findUnique({ where: { id: params.id } });
    if (!member || member.sellerId !== gate.ctx.seller.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.sellerTeamMember.update({
      where: { id: params.id },
      data: { status: 'REMOVED' },
    });

    await prisma.sellerAuditLog.create({
      data: {
        sellerId: gate.ctx.seller.id,
        actorUserId: session!.id,
        actorRole: gate.ctx.actorRole,
        action: 'TEAM_REMOVED',
        details: { removedEmail: member.email } as any,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true, member: updated });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
