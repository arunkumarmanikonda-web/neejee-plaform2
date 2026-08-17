// Edge middleware:
//   (1) Protect sensitive KYC verification endpoints.
//   (2) Redirect legacy storefront URLs to canonical category URLs.
//   (3) Recover a handful of historical admin aliases.
import { jwtVerify } from 'jose';
import { NextResponse, NextRequest } from 'next/server';

const TRAILING_SLASH = /\/+$/;
const KYC_PREFIX = '/api/kyc/verify/';
const INTERNAL_KYC_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'QC_TEAM',
  'FINANCE',
  'FINANCE_OPERATOR',
]);

const rawAuthSecret = process.env.AUTH_SECRET || '';
const authSecret = new TextEncoder().encode(
  rawAuthSecret || 'neejee-dev-secret-change-in-production-please',
);

const BARE_ROOT_REDIRECTS: Record<string, string> = {
  '/women': '/categories/women',
  '/men': '/categories/men',
  '/accessories': '/categories/accessories',
  '/home': '/categories/home',
  '/fragrance': '/categories/fragrance',
  '/gifting': '/categories/gifting',
  '/sarees': '/categories/women/sarees',
  '/saree': '/categories/women/sarees',
  '/banarasi-sarees': '/categories/women/sarees/banarasi-sarees',
  '/sherwanis': '/categories/men/men-apparel/mens-sherwanis',
  '/bandhgalas': '/categories/men/men-apparel/mens-bandhgalas',
  '/nehru-jackets': '/categories/men/men-apparel/mens-nehru-jackets',
  '/lamps': '/categories/home/home-lighting',
  '/lighting': '/categories/home/home-lighting',
  '/wall-art': '/categories/home/home-decor',
  '/decor': '/categories/home/home-decor',
  '/jewellery': '/categories/accessories',
  '/jewelry': '/categories/accessories',
  '/kurtas': '/categories/women',
  '/kurta-sets': '/categories/women',
  '/dupattas': '/categories/women',
  '/lehengas': '/categories/women',
  '/mens-kurtas': '/categories/men',
  '/mojaris': '/categories/men',
  '/juttis': '/categories/men',
  '/cushions': '/categories/home',
  '/rugs': '/categories/home',
  '/attars': '/categories/fragrance',
  '/perfumes': '/categories/fragrance',
  '/banarasi': '/categories/banarasi',
  '/phulkari': '/categories/phulkari',
  '/chikankari': '/categories/chikankari',
  '/kanjeevaram': '/categories/kanjeevaram',
  '/kanchipuram': '/categories/kanjeevaram',
};

async function validJwt(token: string | undefined) {
  if (!token || !rawAuthSecret || rawAuthSecret.length < 32) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret);
    return payload;
  } catch {
    return null;
  }
}

async function hasKycAccess(request: NextRequest) {
  const onboarding = await validJwt(request.cookies.get('neejee-seller-onboarding')?.value);
  if (onboarding?.purpose === 'seller_onboarding' && typeof onboarding.phone === 'string') {
    return true;
  }

  const session = await validJwt(request.cookies.get('neejee-session')?.value);
  const role = typeof session?.role === 'string' ? session.role : '';
  return INTERNAL_KYC_ROLES.has(role);
}

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  if (pathname.startsWith(KYC_PREFIX)) {
    if (request.method === 'OPTIONS') return NextResponse.next();
    if (!(await hasKycAccess(request))) {
      return NextResponse.json(
        { ok: false, error: 'kyc_verification_unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }
    return NextResponse.next();
  }

  if (pathname === '/admin/taxonomy/ai' || pathname === '/admin/taxonomy-ai') {
    const url = new URL('/admin/ai', request.url);
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      if (key !== 'surface') url.searchParams.set(key, value);
    }
    url.searchParams.set('surface', 'taxonomy');
    return NextResponse.redirect(url, 307);
  }

  if (pathname === '/admin/integrations/meta' || pathname === '/admin/meta-accounts') {
    const url = new URL('/admin/ai', request.url);
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      if (key !== 'surface') url.searchParams.set(key, value);
    }
    url.searchParams.set('surface', 'meta');
    return NextResponse.redirect(url, 307);
  }

  const normalised = pathname.toLowerCase().replace(TRAILING_SLASH, '') || '/';
  const bareDest = BARE_ROOT_REDIRECTS[normalised];
  if (bareDest) {
    return NextResponse.redirect(new URL(bareDest, request.url), 308);
  }

  if (!pathname.startsWith('/categories/')) return NextResponse.next();

  const slug = pathname.replace('/categories/', '').replace(TRAILING_SLASH, '');
  if (!slug || slug.includes('/')) return NextResponse.next();

  try {
    const response = await fetch(`${origin}/api/categories/redirect?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!response.ok) return NextResponse.next();
    const data = await response.json();
    if (data?.found && data?.toSlug) {
      const newPath = `/categories/${data.toSlug}${request.nextUrl.search || ''}`;
      return NextResponse.redirect(new URL(newPath, request.url), data.permanent ? 308 : 307);
    }
  } catch {
    // Redirect lookup must never break customer navigation.
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/kyc/verify/:path*',
    '/categories/:path*',
    '/admin/taxonomy/ai',
    '/admin/integrations/meta',
    '/admin/taxonomy-ai',
    '/admin/meta-accounts',
    '/women', '/men', '/accessories', '/home', '/fragrance', '/gifting',
    '/sarees', '/saree', '/banarasi-sarees',
    '/sherwanis', '/bandhgalas', '/nehru-jackets',
    '/lamps', '/lighting', '/wall-art', '/decor',
    '/jewellery', '/jewelry',
    '/kurtas', '/kurta-sets', '/dupattas', '/lehengas',
    '/mens-kurtas', '/mojaris', '/juttis',
    '/cushions', '/rugs', '/attars', '/perfumes',
    '/banarasi', '/phulkari', '/chikankari', '/kanjeevaram', '/kanchipuram',
  ],
};
