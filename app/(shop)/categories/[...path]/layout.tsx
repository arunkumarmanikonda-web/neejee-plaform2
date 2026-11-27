import type { Metadata } from 'next';
import { buildCategoryMetadata } from '@/lib/site/catalog-metadata';

export async function generateMetadata(
  props: {
    params: Promise<{ path: string[] }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return buildCategoryMetadata((params.path || []).join('/'));
}

export default function CategoryPathSeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
