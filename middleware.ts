// v26.3e ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Edge middleware:
//   (1) Bare-root legacy redirects (e.g. /sarees ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ /categories/women/sarees)
//   (2) Existing slug-rename redirects under /categories/* via DB lookup
//
// Both paths return 308 (permanent) so search engines reindex.
//
// Bare roots are a hardcoded map (small, stable, known SEO surface).
// /categories/* renames are DB-driven via CategoryRedirect table.
import { NextResponse, NextRequest } from 'next/server';

const TRAILING_SLASH = /\/+$/;

// Hardcoded bare-root legacy redirects. Keep this list small ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â
// new admin-driven redirects should use CategoryRedirect table instead.
// Destinations verified against live DB (Category table) on 2026-06-21.
const BARE_ROOT_REDIRECTS: Record<string, string> = {
  // L1 mains
  '/women': '/categories/women',
  '/men': '/categories/men',
  '/accessories': '/categories/accessories',
  '/home': '/categories/home',
  '/fragrance': '/categories/fragrance',
  '/gifting': '/categories/gifting',

  // Verified L2/L3 destinations
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

  // Defunct/missing L2 ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â point to nearest live ancestor
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

  // Craft-fallbacks ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â resolver handles these natively via craft match
  '/banarasi': '/categories/banarasi',
  '/phulkari': '/categories/phulkari',
  '/chikankari': '/categories/chikankari',
  '/kanjeevaram': '/categories/kanjeevaram',
  '/kanchipuram': '/categories/kanjeevaram',
};

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // Ã¢â€â‚¬Ã¢â€â‚¬ (0) Admin surface recovery redirect Ã¢â‚¬â€ intercept blocked direct routes before app resolution Ã¢â€â‚¬Ã¢â€â‚¬
  if (
    pathname === '/admin/taxonomy/ai' ||
    pathname === '/admin/taxonomy-ai'
  ) {
    const url = new URL('/admin/ai', request.url);
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      if (key !== 'surface') url.searchParams.set(key, value);
    }
    url.searchParams.set('surface', 'taxonomy');
    return NextResponse.redirect(url, 307);
  }

  if (
    pathname === '/admin/integrations/meta' ||
    pathname === '/admin/meta-accounts'
  ) {
    const url = new URL('/admin/ai', request.url);
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      if (key !== 'surface') url.searchParams.set(key, value);
    }
    url.searchParams.set('surface', 'meta');
    return NextResponse.redirect(url, 307);
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ (1) Bare-root legacy redirect ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â check hardcoded map first ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  // Normalise: lowercase, strip trailing slash
  const normalised = pathname.toLowerCase().replace(TRAILING_SLASH, '') || '/';
  const bareDest = BARE_ROOT_REDIRECTS[normalised];
  if (bareDest) {
    return NextResponse.redirect(new URL(bareDest, request.url), 308);
  }

  // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ (2) Existing logic ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â /categories/<oldSlug> rename via DB lookup ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
  if (!pathname.startsWith('/categories/')) return NextResponse.next();

  const slug = pathname.replace('/categories/', '').replace(TRAILING_SLASH, '');
  if (!slug) return NextResponse.next();

  // Multi-level paths handled by the [...path] catch-all page
  if (slug.includes('/')) return NextResponse.next();

  try {
    const r = await fetch(`${origin}/api/categories/redirect?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.next();
    const data = await r.json();
    if (data?.found && data?.toSlug) {
      const newPath = `/categories/${data.toSlug}${request.nextUrl.search || ''}`;
      const status = data.permanent ? 308 : 307;
      return NextResponse.redirect(new URL(newPath, request.url), status);
    }
  } catch {
    // Silent fail ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â never break the user's request
  }
  return NextResponse.next();
}

// Matcher: only fire on the paths we actually handle.
// Bare roots are listed individually so unrelated requests skip the middleware entirely (zero overhead).
export const config = {
  matcher: [
    '/categories/:path*',
    '/admin/taxonomy/ai',
    '/admin/integrations/meta',
    '/admin/taxonomy-ai',
    '/admin/meta-accounts',
    // Bare-root legacy URLs
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