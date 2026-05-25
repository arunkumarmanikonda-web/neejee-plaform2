import { NextResponse } from 'next/server';
import { setSessionCookie, hashPassword } from '@/lib/auth';
import { isValidEmail } from '@/lib/utils';
import { z } from 'zod';

const SignupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

// PRODUCTION: persist via Prisma. In-memory store for dev only.
const users: Record<string, { id: string; name: string; email: string; passwordHash: string }> = {};

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }
  const { name, email, password } = parsed.data;
  if (users[email]) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }
  const id = 'u_' + Math.random().toString(36).slice(2, 10);
  const passwordHash = await hashPassword(password);
  users[email] = { id, name, email, passwordHash };

  // PRODUCTION:
  //   await prisma.user.create({ data: { id, name, email, passwordHash, role: 'CUSTOMER' } });
  //   await sendKlaviyoEvent('account_created', { email, name });

  await setSessionCookie({ id, email, name, role: 'CUSTOMER' });
  return NextResponse.json({ success: true, user: { id, name, email } });
}
