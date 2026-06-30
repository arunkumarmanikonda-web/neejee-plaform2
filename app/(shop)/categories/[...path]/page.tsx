import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PageProps = {
  params: {
    path: string | string[];
  };
};

function normalizeSegment(value: string): string {
  return decodeURIComponent(value).trim().replace(/^\/+|\/+$/g, '').toLowerCase();
}

function normalizePathInput(path: string | string[]): string[] {
  const parts = Array.isArray(path) ? path : [path];
  return parts.map(normalizeSegment).filter(Boolean);
}

function normalizeRedirectTarget(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/^\/+|\/+$/g, '');
  if (!cleaned) return null;
  const segments = cleaned.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

export default async function LegacyCategoryPathPage({ params }: PageProps) {
  const parts = normalizePathInput(params.path);

  if (!parts.length) {
    redirect('/products');
  }

  const joinedPath = parts.join('/');
  const leafSlug = parts[parts.length - 1];

  const [categoryByPath, categoryBySlug, redirectByPath, redirectBySlug] = await Promise.all([
    prisma.category
      .findFirst({
        where: { path: joinedPath },
        select: { slug: true, path: true },
      })
      .catch(() => null),

    prisma.category
      .findFirst({
        where: { slug: leafSlug },
        select: { slug: true, path: true },
      })
      .catch(() => null),

    prisma.categoryRedirect
      .findUnique({
        where: { fromSlug: joinedPath },
        select: { toSlug: true, permanent: true },
      })
      .catch(() => null),

    prisma.categoryRedirect
      .findUnique({
        where: { fromSlug: leafSlug },
        select: { toSlug: true, permanent: true },
      })
      .catch(() => null),
  ]);

  const canonicalSlug =
    categoryByPath?.slug ??
    categoryBySlug?.slug ??
    normalizeRedirectTarget(redirectByPath?.toSlug) ??
    normalizeRedirectTarget(redirectBySlug?.toSlug) ??
    leafSlug;

  redirect(`/categories/${encodeURIComponent(canonicalSlug)}`);
}
