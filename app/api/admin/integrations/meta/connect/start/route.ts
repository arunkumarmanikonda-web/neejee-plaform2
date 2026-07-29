import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMetaOAuthUrl, type MetaConnectKind } from '@/lib/social/meta';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = ['ADMIN', 'SUPER_ADMIN', 'MARKETING_MANAGER', 'MARKETING_OPERATOR'];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !ALLOWED.includes(session.role as any)) {
    return NextResponse.redirect(new URL('/admin?error=unauthorized', req.url));
  }

  const kind = ((req.nextUrl.searchParams.get('kind') || 'facebook').toLowerCase() === 'instagram'
    ? 'instagram'
    : 'facebook') as MetaConnectKind;

  const state = randomUUID();
  const response = NextResponse.redirect(getMetaOAuthUrl(kind, state));

  response.cookies.set(
    'neejee-meta-oauth',
    JSON.stringify({ state, kind, issuedAt: Date.now(), userId: session.id }),
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10,
    },
  );

  return response;
}