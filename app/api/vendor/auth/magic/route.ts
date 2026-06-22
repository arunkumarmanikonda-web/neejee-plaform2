// POST /api/vendor/auth/magic { token } — verifies magic-link token, creates
// (or links) a User with role=VENDOR, sets the session cookie.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { consumeMagicToken } from '@/lib/vendor-auth';
import { setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}
  const token = String(body?.token || '').trim();
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const result = await consumeMagicToken(token);
  if (!result) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { id: result.vendorId } });
  if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  if (vendor.status === 'ARCHIVED' || vendor.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
  }

  // Ensure a User exists for this vendor (role=VENDOR). If the contact email is
  // already taken by another role, we attach to that user but ensure role grants.
  let user = await prisma.user.findUnique({ where: { email: vendor.contactEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: vendor.contactEmail,
        name: vendor.contactPerson || vendor.legalName,
        role: 'VENDOR',
        emailVerified: new Date(),
      },
    });
  } else if (user.role !== 'VENDOR' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    // Promote a CUSTOMER-role account to VENDOR if they share the email
    user = await prisma.user.update({ where: { id: user.id }, data: { role: 'VENDOR' } });
  }

  // Link vendor → user if not already linked
  if (vendor.userId !== user.id) {
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: { userId: user.id, status: vendor.status === 'PENDING' ? 'ACTIVE' : vendor.status },
    });
  } else if (vendor.status === 'PENDING') {
    await prisma.vendor.update({ where: { id: vendor.id }, data: { status: 'ACTIVE' } });
  }

  await setSessionCookie({
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role as any,
  });
  return NextResponse.json({
    ok: true,
    vendorId: vendor.id,
    hasPassword: !!user.passwordHash,
  });
}
