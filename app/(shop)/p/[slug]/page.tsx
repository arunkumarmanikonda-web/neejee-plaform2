import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    slug: string | string[];
  };
};

export default async function ShortProductRedirectPage({ params }: PageProps) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  if (!slug || !slug.trim()) {
    redirect('/products');
  }

  // Older newsletters and CMS cards linked to journal entries through /p.
  const article = await prisma.cmsPage.findFirst({
    where: { slug, pageType: 'journal', status: 'PUBLISHED' },
    select: { id: true },
  }).catch(() => null);
  if (article) {
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) redirect(`/journal/${encodeURIComponent(slug)}`);
  }
  redirect(`/products/${encodeURIComponent(slug)}`);
}
