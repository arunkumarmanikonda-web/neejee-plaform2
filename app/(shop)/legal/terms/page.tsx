import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export default async function ShoppingPolicies() {
  const terms = await prisma.cmsPage.findFirst({
    where: { slug: { in: ['terms','terms-of-service','terms-and-conditions'] }, status: 'PUBLISHED', pageType: { not: 'catalogue' } },
    select: { slug: true },
  });
  if (terms) redirect('/pages/' + encodeURIComponent(terms.slug));
  return <article className="mx-auto max-w-2xl px-6 py-16 space-y-6">
    <h1 className="font-display text-4xl">Shopping policies</h1>
    <p>Read the policies that apply when you shop with Neejee.</p>
    <ul className="space-y-4 text-madder">
      <li><Link href="/help/shipping">Shipping and delivery</Link></li>
      <li><Link href="/help/returns">Returns and exchanges</Link></li>
      <li><Link href="/legal/privacy">Privacy notice</Link></li>
      <li><Link href="/help/contact">Contact Neejee</Link></li>
    </ul></article>;
}
