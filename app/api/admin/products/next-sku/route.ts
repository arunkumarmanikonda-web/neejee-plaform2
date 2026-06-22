// /api/admin/products/next-sku
// Returns the next auto-generated SKU for a given craft / categoryId.
// Used by the "New Product" page to preview the SKU before submit.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { nextSku } from '@/lib/sku-generator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const craft = url.searchParams.get('craft') || undefined;
  const categoryId = url.searchParams.get('categoryId') || undefined;

  let categoryName: string | undefined;
  if (categoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });
    categoryName = cat?.name;
  }

  const sku = await nextSku({ craft, categoryName });
  return NextResponse.json({ sku });
}
