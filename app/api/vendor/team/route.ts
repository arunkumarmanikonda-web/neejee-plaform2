// GET  /api/vendor/team       — list team members
// POST /api/vendor/team       — invite a new team member (email + access level)
// Only the vendor OWNER (role=VENDOR) can manage team members.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createMagicTokenForVendor } from '@/lib/vendor-auth';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_LEVELS = ['FULL', 'FINANCE_ONLY', 'OPERATIONS_ONLY'];

function productionBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  return (explicit || 'https://www.neejee.com').replace(/\/$/, '');
}

async function ownerGate() {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') {
    return { error: 'Only the primary vendor user can manage the team', status: 403 };
  }
  const vendor = await prisma.vendor.findUnique({ where: { userId: session.id } });
  if (!vendor) return { error: 'No vendor profile', status: 404 };
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
  let body: any = {};
  try { body = await request.json(); } catch {}
  const email = String(body?.email || '').trim().toLowerCase();
  const displayName = body?.displayName ? String(body.displayName).slice(0, 100) : null;
  const accessLevel = String(body?.accessLevel || 'FULL').toUpperCase();
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
  }
  if (!VALID_LEVELS.includes(accessLevel)) {
    return NextResponse.json({ error: 'Invalid access level' }, { status: 400 });
  }
  if (email === g.vendor.contactEmail) {
    return NextResponse.json({ error: 'You cannot invite yourself; you are already the primary user' }, { status: 400 });
  }

  // Find or create the User row (role VENDOR_STAFF)
  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    // Conflict: if this email already belongs to a non-vendor-staff account, bail
    if (!['VENDOR_STAFF', 'CUSTOMER'].includes(user.role)) {
      return NextResponse.json({ error: 'This email is already in use by a non-vendor account' }, { status: 409 });
    }
    // Promote a CUSTOMER to VENDOR_STAFF for this purpose
    if (user.role === 'CUSTOMER') {
      user = await prisma.user.update({ where: { id: user.id }, data: { role: 'VENDOR_STAFF' } });
    }
  } else {
    user = await prisma.user.create({
      data: {
        email,
        name: displayName,
        role: 'VENDOR_STAFF',
        emailVerified: null,
      },
    });
  }

  // Check if team member already exists
  const existing = await prisma.vendorTeamMember.findUnique({ where: { userId: user.id } });
  if (existing) {
    if (existing.vendorId !== g.vendor.id) {
      return NextResponse.json({ error: 'This user is already a team member of another vendor' }, { status: 409 });
    }
    return NextResponse.json({ error: 'This user is already on your team' }, { status: 409 });
  }

  const member = await prisma.vendorTeamMember.create({
    data: {
      vendorId: g.vendor.id,
      userId: user.id,
      displayName,
      email,
      accessLevel: accessLevel as any,
      status: 'INVITED',
      invitedByUserId: g.session.id,
    },
  });

  // Send invite email with magic link
  try {
    const { token, expiresAt } = await createMagicTokenForVendor({
      vendorId: g.vendor.id,
      purpose: 'LOGIN',
    });
    const loginUrl = `${productionBaseUrl()}/vendor/login?token=${encodeURIComponent(token)}`;
    await sendEmail({
      to: email,
      subject: `${g.vendor.displayName || g.vendor.legalName} invited you to NEEJEE Vendor Portal`,
      html: `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;background:#F2EAD9;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#FBF5E8;padding:40px;border:1px solid #D4C8A8;">
    <h1 style="font-family:'Cormorant Garamond',Georgia,serif;color:#2B2118;margin:0 0 8px;">NEE<span style="color:#9F2B3C;">·</span>JEE</h1>
    <p style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#7A6952;margin:0 0 24px;">Vendor Portal</p>
    <p style="color:#2B2118;line-height:1.7;">${g.vendor.displayName || g.vendor.legalName} has invited you to their NEEJEE Vendor Portal account as <strong>${accessLevel.replace('_', ' ').toLowerCase()}</strong>.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:#9F2B3C;color:#FBF5E8;text-decoration:none;letter-spacing:2px;text-transform:uppercase;font-size:13px;">Accept invitation</a>
    </p>
    <p style="font-size:11px;color:#7A6952;">This link expires on ${expiresAt.toLocaleString('en-IN')}.</p>
  </div>
</body></html>`,
    });
  } catch (e) {
    console.warn('[team invite email]', e);
  }

  await prisma.vendorAuditLog.create({
    data: {
      vendorId: g.vendor.id,
      actorUserId: g.session.id,
      actorRole: 'VENDOR',
      action: 'TEAM_MEMBER_INVITED',
      details: { teamMemberId: member.id, email, accessLevel },
    },
  });

  return NextResponse.json({ member }, { status: 201 });
}
