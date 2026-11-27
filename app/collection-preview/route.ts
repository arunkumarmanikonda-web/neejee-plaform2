import { NextRequest, NextResponse } from 'next/server';
import { reviewCookie } from '@/lib/collection-review';

export const dynamic = 'force-dynamic';
export function GET(req:NextRequest) {
  const response = NextResponse.redirect(new URL('/', req.url), 303);
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('X-Robots-Tag','noindex, nofollow');
  response.cookies.set(reviewCookie,req.nextUrl.searchParams.get('exit') === '1' ? '' : '1',{
    path:'/', sameSite:'lax', secure:req.nextUrl.protocol==='https:',
    ...(req.nextUrl.searchParams.get('exit') === '1' ? {maxAge:0} : {}),
  });
  return response;
}
