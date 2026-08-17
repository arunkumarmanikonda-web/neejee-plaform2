import type { Metadata } from 'next';
import { buildCategoryMetadata } from '@/lib/site/catalog-metadata';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  return buildCategoryMetadata(params.slug);
}

export default function CategorySeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
