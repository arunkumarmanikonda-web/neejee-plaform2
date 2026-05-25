import { NextResponse } from 'next/server';
import { setSessionCookie, verifyPassword } from '@/lib/auth';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Dev: hardcoded demo user. Production: Prisma lookup.
const demoUsers = [
  { id: 'demo1', name: 'Aanya M.', email: 'demo@neejee.com', passwordHash: '$2a$12$DummyHashPlaceholderForDevModeOnlyDoNotUseInProd' },
];

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const { email, password } = parsed.data;

  // DEV BYPASS: accept demo@neejee.com / neejee123 for testing
  if (email === 'demo@neejee.com' && password === 'neejee123') {
    await setSessionCookie({ id: 'demo1', email, name: 'Aanya M.', role: 'CUSTOMER' });
    return NextResponse.json({ success: true });
  }
  if (email === 'admin@neejee.com' && password === 'admin123') {
    await setSessionCookie({ id: 'admin1', email, name: 'Nidhi Chauhan', role: 'SUPER_ADMIN' });
    return NextResponse.json({ success: true });
  }

  // PRODUCTION:
  //   const user = await prisma.user.findUnique({ where: { email } });
  //   if (!user || !await verifyPassword(password, user.passwordHash)) {
  //     return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  //   }
  //   await setSessionCookie({ id: user.id, email, name: user.name, role: user.role });

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
