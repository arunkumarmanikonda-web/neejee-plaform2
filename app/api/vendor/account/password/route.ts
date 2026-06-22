// POST /api/vendor/account/password
// Body: { currentPassword?: string, newPassword: string }
// If user already has a password, currentPassword is required (verify it).
// If user has no password yet (magic-link-only signups), set one without verification.
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!['VENDOR', 'VENDOR_STAFF'].includes(session.role)) {
    return NextResponse.json({ error: 'Vendor accounts only' }, { status: 403 });
  }
  let body: any = {};
  try { body = await request.json(); } catch {}

  const newPassword = String(body?.newPassword || '');
  const currentPassword = String(body?.currentPassword || '');

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // If they already have a password, verify the current one first
  if (user.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required to change it' }, { status: 400 });
    }
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });

  // Audit log — find the vendor this user belongs to
  let vendorId: string | null = null;
  if (session.role === 'VENDOR') {
    const v = await prisma.vendor.findUnique({ where: { userId: session.id }, select: { id: true } });
    vendorId = v?.id || null;
  } else {
    const tm = await prisma.vendorTeamMember.findUnique({ where: { userId: session.id }, select: { vendorId: true } });
    vendorId = tm?.vendorId || null;
  }
  if (vendorId) {
    await prisma.vendorAuditLog.create({
      data: {
        vendorId,
        actorUserId: session.id,
        actorRole: session.role,
        action: user.passwordHash ? 'PASSWORD_CHANGED' : 'PASSWORD_SET',
      },
    });
  }
  return NextResponse.json({ ok: true });
}
