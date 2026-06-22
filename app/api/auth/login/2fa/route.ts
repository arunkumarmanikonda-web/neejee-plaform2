// v23.37 — Admin 2FA completion endpoint
// After /api/auth/login returns { requires2FA: true }, client POSTs here with
// { email, password, code } to complete sign-in.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, verifyPassword } from '@/lib/auth';
import { verifyOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  code: z.string().min(4).max(8),
});

function redirectFor(role: string): string {
  if (['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'].includes(role)) return '/admin';
  if (role === 'SELLER') return '/seller';
  return '/account';
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const { email, password, code } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !user.phone) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  // Re-check password — never trust the client's earlier successful call
  const passOk = await verifyPassword(password, user.passwordHash);
  if (!passOk) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Not eligible for 2FA' }, { status: 403 });
  }

  // Verify the OTP code against the recent admin_2fa OTP
  const v = await verifyOtp({ phone: user.phone, purpose: 'admin_2fa', code });
  if (!v.ok) {
    return NextResponse.json({ error: v.error || 'Invalid 2FA code' }, { status: 401 });
  }

  await setSessionCookie({
    id: user.id, email: user.email,
    name: user.name || undefined, role: user.role as any,
  });

  return NextResponse.json({
    success: true,
    role: user.role,
    redirect: redirectFor(user.role),
  });
}
