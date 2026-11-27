import type { Metadata } from 'next';
import { buildCategoryMetadata } from '@/lib/site/catalog-metadata';

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return buildCategoryMetadata(params.slug);
}

export default function CategorySeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
