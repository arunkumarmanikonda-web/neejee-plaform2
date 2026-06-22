// Public banners endpoint — returns active, scheduled banners by position.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const position = url.searchParams.get('position');
  if (!position) return NextResponse.json({ banners: [] });

  try {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        position,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ banners });
  } catch (e: any) {
    return NextResponse.json({ banners: [], error: e.message }, { status: 200 });
  }
}
