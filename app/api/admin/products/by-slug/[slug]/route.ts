// v23.40.20.2 — Slug fallback lookup for admin product editor.
// Used when the primary [id] route returns 404 and the editor wants to retry with a slug.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const slug = String(params.slug || '').trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
  try {
    const product = await prisma.product.findFirst({
      where: { OR: [{ slug }, { sku: params.slug }] },
      include: { category: true, variants: { orderBy: { sku: 'asc' } }, seller: true },
    });
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ product });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
