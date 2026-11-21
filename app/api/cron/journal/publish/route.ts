import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const result = await prisma.cmsPage.updateMany({
    where: { pageType: 'journal', status: 'PREVIEW', scheduledAt: { lte: now } },
    data: { status: 'PUBLISHED', publishedAt: now, scheduledAt: null },
  });
  if (result.count) {
    revalidatePath('/');
    revalidatePath('/journal');
    revalidatePath('/sitemap.xml');
  }
  return NextResponse.json({ published: result.count });
}
