// Public contact + top-level shopping navigation used by the Footer and other
// storefront surfaces. Admin edits may take up to one minute to reach the edge.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicContact } from '@/lib/public-contact';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const [contact, categories] = await Promise.all([
    getPublicContact().catch(() => null),
    prisma.category.findMany({
      where: { active: true, parentId: null },
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true },
      take: 7,
    }).catch(() => [] as any[]),
  ]);

  const response = NextResponse.json({ contact, categories });
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  response.headers.set('CDN-Cache-Control', 'max-age=60, stale-while-revalidate=300');
  response.headers.set('Vercel-CDN-Cache-Control', 'max-age=60, stale-while-revalidate=300');
  return response;
}
