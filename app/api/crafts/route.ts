// Public crafts list — used by /crafts landing and homepage rails
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const featured = url.searchParams.get('featured') === '1';
    const crafts = await prisma.craft.findMany({
      where: { active: true, ...(featured ? { featured: true } : {}) },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true, slug: true, name: true, region: true, state: true,
        description: true, image: true, thumbnail: true, featured: true,
      },
    });
    return NextResponse.json({ crafts });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}
