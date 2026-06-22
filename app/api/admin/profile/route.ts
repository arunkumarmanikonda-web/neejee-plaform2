// Admin self-profile update (name, phone, password)
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const data: any = {};
    if (body.name !== undefined) data.name = String(body.name).trim() || null;
    if (body.phone !== undefined) data.phone = String(body.phone).trim() || null;
    if (body.password) {
      if (body.password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      data.passwordHash = await hashPassword(body.password);
    }
    const updated = await prisma.user.update({
      where: { id: session.id },
      data,
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
    return NextResponse.json({ success: true, user: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
