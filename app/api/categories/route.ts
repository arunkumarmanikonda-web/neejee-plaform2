import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      // v26.1.4 — return path/level so the CategoryPicker can show breadcrumbs
      // on the product edit page (pre-selecting an existing category).
      select: { id: true, name: true, slug: true, path: true, level: true },
    });
    return NextResponse.json({ categories });
  } catch (e: any) {
    return NextResponse.json({ categories: [], error: e.message }, { status: 500 });
  }
}
