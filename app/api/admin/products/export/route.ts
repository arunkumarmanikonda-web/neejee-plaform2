// Export current inventory as a .xlsx file, with the first product image
// embedded inline in each row so the catalog can be reviewed visually.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildExportWorkbook } from '@/lib/inventory-io';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120; // embedding images for many products takes time

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status'); // ACTIVE | DRAFT | ARCHIVED | PENDING_QC | REJECTED | null = all

  const where: any = {};
  if (statusFilter && statusFilter !== 'all') {
    where.status = statusFilter;
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      sku: true,
      slug: true,
      craft: true,
      region: true,
      material: true,
      mrp: true,
      sellingPrice: true,
      status: true,
      images: true,
      createdAt: true,
      category: { select: { slug: true, name: true, path: true } },
      variants: {
        select: {
          sku: true,
          size: true,
          color: true,
          material: true,
          inventory: true,
          sellingPrice: true,
        },
        orderBy: { sku: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000, // safety cap — embedded images make the file heavy
  });

  // Map to ExportProduct shape (handles missing category)
  const exportProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    slug: p.slug,
    category: p.category || { slug: '', name: '' },
    craft: p.craft,
    region: p.region,
    material: p.material,
    mrp: p.mrp,
    sellingPrice: p.sellingPrice,
    status: p.status,
    images: p.images || [],
    createdAt: p.createdAt,
    variants: p.variants,
  }));

  const buf = await buildExportWorkbook(exportProducts);

  const today = new Date().toISOString().slice(0, 10);
  const tag = statusFilter && statusFilter !== 'all' ? `-${statusFilter.toLowerCase()}` : '';
  const filename = `neejee-inventory${tag}-${today}.xlsx`;

  return new NextResponse(buf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
