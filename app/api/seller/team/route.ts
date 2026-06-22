// Seller team management — list + invite.
// GET  /api/seller/team
// POST /api/seller/team  body: { email, displayName?, accessLevel }
import { NextResponse } from 'next/server';
import crypto from 'crypto';
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

export async function POST(req: Request) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!canManageAccount(gate.ctx)) {
    return NextResponse.json({ error: 'Only the studio owner can invite team members' }, { status: 403 });
  }

  try {
    const { email, displayName, accessLevel = 'INVENTORY_ONLY' } = await req.json();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    const normEmail = String(email).toLowerCase().trim();

    // Already invited?
    const existing = await prisma.sellerTeamMember.findFirst({
      where: { sellerId: gate.ctx.seller.id, email: normEmail, status: { not: 'REMOVED' } },
    });
    if (existing) {
      return NextResponse.json({ error: 'This person is already on the team' }, { status: 400 });
    }

    // Find or create a User row with SELLER_STAFF role
    let user = await prisma.user.findUnique({ where: { email: normEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normEmail,
          name: displayName || normEmail.split('@')[0],
          role: 'SELLER_STAFF',
        },
      });
    } else if (user.role === 'CUSTOMER') {
      // Promote existing customer
      user = await prisma.user.update({
        where: { id: user.id },
        data: { role: 'SELLER_STAFF' },
      });
    } else if (user.role !== 'SELLER_STAFF' && user.role !== 'SELLER') {
      return NextResponse.json({
        error: `This email is already used by a ${user.role} account.`,
      }, { status: 400 });
    }

    const member = await prisma.sellerTeamMember.create({
      data: {
        sellerId: gate.ctx.seller.id,
        userId: user.id,
        email: normEmail,
        displayName: displayName || null,
        accessLevel: accessLevel as any,
        status: 'INVITED',
        invitedByUserId: session!.id,
      },
    });

    // Magic-link invitation
    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.sellerMagicToken.create({
      data: {
        sellerId: gate.ctx.seller.id,
        tokenHash,
        purpose: 'TEAM_INVITE',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),  // 7 days
      },
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.neejee.com'}/seller/login?token=${token}`;

    // Notify the invitee
    try {
      const { notify } = await import('@/lib/notifications');
      notify({
        event: 'SELLER_TEAM_INVITED' as any,
        recipients: [{ email: normEmail, name: displayName || normEmail }],
        data: {
          sellerName: gate.ctx.seller.businessName,
          accessLevel,
          inviteUrl,
        },
      }).catch(() => {});
    } catch { /* */ }

    await prisma.sellerAuditLog.create({
      data: {
        sellerId: gate.ctx.seller.id,
        actorUserId: session!.id,
        actorRole: gate.ctx.actorRole,
        action: 'TEAM_INVITED',
        details: { invitedEmail: normEmail, accessLevel } as any,
      },
    }).catch(() => {});

    return NextResponse.json({ member, inviteUrl }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
