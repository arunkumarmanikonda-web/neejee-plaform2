import { NextResponse } from 'next/server';
import { setSessionCookie } from '@/lib/auth';
import { acceptInvitation, InvitationError } from '@/lib/team-invitations';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.token !== 'string' || body.token.length > 2500) return NextResponse.json({ error: 'Invalid invitation.' }, { status: 400 });
  try {
    const { kind, ...user } = await acceptInvitation(body.token, String(body.password || ''));
    await setSessionCookie(user);
    return NextResponse.json({ destination: '/' + kind + '/dashboard' });
  } catch (error) {
    if (error instanceof InvitationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Could not complete acceptance. Please try again.' }, { status: 503 });
  }
}
