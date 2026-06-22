// v23.40.25 — Public site config endpoint.
// Returns contact info (from LegalEntity) and top categories — used by the
// Footer and other public surfaces so any admin edit in /admin/legal-entity
// or /admin/categories propagates without redeploy.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPublicContact } from '@/lib/public-contact';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Cache lightly at the edge — admin edits propagate within 60s anyway via
// the LegalEntity in-memory cache.
export const revalidate = 60;

export async function GET() {
  const [contact, categories] = await Promise.all([
    getPublicContact().catch(() => null),
    prisma.category.findMany({
      where: { active: true, parentId: null },
      orderBy: [{ featured: 'desc' }, { order: 'asc' }, { name: 'asc' }],
      select: { slug: true, name: true },
      take: 7,
    }).catch(() => [] as any[]),
  ]);

  return NextResponse.json({ contact, categories });
}
