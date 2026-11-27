import { prisma } from '@/lib/prisma';
import { publicEditorialWhere } from '@/lib/public-editorial';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{
    slug: string | string[];
  }>;
};

export default async function ShortProductRedirectPage(props: PageProps) {
  const params = await props.params;
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  if (!slug || !slug.trim()) {
    redirect('/products');
  }

  // Older newsletters and CMS cards linked to journal entries through /p.
  const article = await prisma.cmsPage.findFirst({
    where: { AND: [publicEditorialWhere,{slug}] },
    select: { pageType: true },
  }).catch(() => null);
  if (article) {
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!product) redirect(`/${article.pageType === 'journal' ? 'journal' : 'pages'}/${encodeURIComponent(slug)}`);
  }
  redirect(`/products/${encodeURIComponent(slug)}`);
}
