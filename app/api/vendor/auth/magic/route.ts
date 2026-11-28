// POST /api/vendor/auth/magic { token } — verifies magic-link token, creates
// (or links) a User with role=VENDOR, sets the session cookie.
import { NextResponse } from 'next/server';
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

  const { user, vendorId } = result;
  if (user.role !== 'VENDOR' && user.role !== 'VENDOR_STAFF') return NextResponse.json({ error: 'Invalid account role' }, { status: 403 });
  await setSessionCookie({ id: user.id, email: user.email, name: user.name || undefined, role: user.role });
  return NextResponse.json({ ok: true, vendorId, hasPassword: !!user.passwordHash });
}
