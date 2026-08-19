import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function StoryPage({ params }: { params: { slug: string } }) {
  try {
    const cmsPage = await prisma.cmsPage.findFirst({
      where: {
        slug: params.slug,
        pageType: 'journal',
        status: 'PUBLISHED',
      },
      select: { slug: true },
    });

    if (cmsPage) {
      redirect(`/p/${cmsPage.slug}`);
    }
  } catch {
    // Database unavailable or no published journal record: do not expose
    // prototype content as a customer-facing fallback.
  }

  notFound();
}
