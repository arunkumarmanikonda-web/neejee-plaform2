import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchProducts as mockSearch } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  if (!q || q.length < 2) {
    return NextResponse.json({
      results: [],
      suggestions: ['Banarasi', 'Phulkari', 'Kanjeevaram', 'Attar', 'Jhumkas', 'Pashmina', 'Chanderi', 'Ajrakh'],
    });
  }

  // Try Prisma full-text-ish search
  if (process.env.DATABASE_URL) {
    try {
      const results = await prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { craft: { contains: q, mode: 'insensitive' } },
            { region: { contains: q, mode: 'insensitive' } },
            { material: { contains: q, mode: 'insensitive' } },
            { artisanName: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 12,
      });
      return NextResponse.json({ results, count: results.length, query: q, source: 'db' });
    } catch (e: any) {
      console.warn('[search API] DB failed, falling back:', e.message);
    }
  }

  // Mock fallback
  const results = mockSearch(q).slice(0, 12);
  return NextResponse.json({ results, count: results.length, query: q, source: 'mock' });
}
