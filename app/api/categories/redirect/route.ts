// v23.40.26.0 — Category redirect lookup
// GET /api/categories/redirect?slug=jewellery → { toSlug: 'accessories/jewellery', permanent: true }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim().toLowerCase();
  if (!slug) return NextResponse.json({ found: false });
  const redirect = await prisma.categoryRedirect.findUnique({
    where: { fromSlug: slug },
    select: { toSlug: true, permanent: true },
  });
  if (!redirect) return NextResponse.json({ found: false });
  // Fire-and-forget hit counter
  prisma.categoryRedirect.update({
    where: { fromSlug: slug },
    data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
  }).catch(() => {});
  return NextResponse.json({ found: true, ...redirect });
}
