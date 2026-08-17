import type { Metadata } from 'next';
import { buildCategoryMetadata } from '@/lib/site/catalog-metadata';

export async function generateMetadata({
  params,
}: {
  params: { path: string[] };
}): Promise<Metadata> {
  return buildCategoryMetadata((params.path || []).join('/'));
}

export default function CategoryPathSeoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
