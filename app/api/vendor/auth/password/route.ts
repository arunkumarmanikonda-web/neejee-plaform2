// POST /api/vendor/auth/password
// Two modes:
//   { email, password }              → sign in with existing password
//   { setPassword: true, password }  → set/change password for the *current* session user
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { getSession, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: any = {};
  try { body = await request.json(); } catch {}

  // Mode 2: set password (must be logged in)
  if (body?.setPassword) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    if (session.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Vendor accounts only' }, { status: 403 });
    }
    const pwd = String(body?.password || '');
    if (pwd.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    const passwordHash = await bcrypt.hash(pwd, 10);
    await prisma.user.update({ where: { id: session.id }, data: { passwordHash } });
    return NextResponse.json({ ok: true });
  }

  // Mode 1: sign in
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  if (user.role !== 'VENDOR') {
    return NextResponse.json({ error: 'This account is not a vendor account' }, { status: 403 });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { userId: user.id } });
  if (!vendor || vendor.status === 'ARCHIVED' || vendor.status === 'SUSPENDED') {
    return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
  }

  await setSessionCookie({
    id: user.id, email: user.email, name: user.name || undefined, role: 'VENDOR',
  });
  return NextResponse.json({ ok: true, vendorId: vendor.id });
}
