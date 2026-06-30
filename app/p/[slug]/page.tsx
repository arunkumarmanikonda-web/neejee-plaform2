import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    slug: string | string[];
  };
};

export default function ShortProductRedirectPage({ params }: PageProps) {
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

  if (!slug || !slug.trim()) {
    redirect('/products');
  }

  redirect(`/products/${encodeURIComponent(slug)}`);
}
