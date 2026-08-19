import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function expireAuthCookie(response: NextResponse, name: string) {
  response.cookies.set(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
}

export async function POST() {
  const response = NextResponse.json({ success: true });

  expireAuthCookie(response, 'neejee-session');
  expireAuthCookie(response, 'neejee-admin-mfa');

  return response;
}
