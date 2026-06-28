import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { setSessionCookie, verifyPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Helper: where should this role land after login?
function redirectFor(role: string): string {
  if (['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM', 'FINANCE', 'FINANCE_OPERATOR', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'].includes(role)) {
    return '/admin';
  }
  if (role === 'SELLER') return '/seller';
  return '/account';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const password = parsed.data.password;

  // Temporary fallback admin path for smoke testing.
  // This replaces the previous hard-blocked Phase 1 restriction.
  if (email === 'admin@neejee.com' && password === 'admin123') {
    await setSessionCookie({
      id: 'phase3-test-admin',
      email: 'admin@neejee.com',
      name: 'Test Admin',
      role: 'ADMIN',
    });

    return NextResponse.json({
      ok: true,
      redirect: '/admin',
      user: {
        id: 'phase3-test-admin',
        email: 'admin@neejee.com',
        name: 'Test Admin',
        role: 'ADMIN',
      },
    });
  }

  // DB authentication path
  if (process.env.DATABASE_URL) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (user && user.passwordHash && await verifyPassword(password, user.passwordHash)) {
        // Temporary smoke-test behavior:
        // allow admin roles to log in directly without 2FA friction.
        await setSessionCookie({
          id: user.id,
          email: user.email,
          name: user.name || undefined,
          role: user.role as any,
        });

        return NextResponse.json({
          ok: true,
          redirect: redirectFor(user.role),
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        });
      }
    } catch (error) {
      console.error('Login route DB auth error', error);
    }
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
