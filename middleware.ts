// Edge middleware — runs before every request
// Protects /admin and /api/admin routes; redirects to /login if unauthenticated
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'neejee-dev-secret-change-in-production-please'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('neejee-session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login?next=' + pathname, request.url));
  }
  try {
    const { payload } = await jwtVerify(token, secret);
    const role = (payload as any).role;
    if (!['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'].includes(role)) {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login?next=' + pathname, request.url));
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
