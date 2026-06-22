// v23.40.20.3 — Bulk product actions (archive / activate / set status / delete).
// POST /api/admin/products/bulk
// Body: { ids: string[], action: 'ACTIVATE' | 'ARCHIVE' | 'DRAFT' | 'PENDING_QC' | 'REJECT' | 'DELETE' }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS_MAP: Record<string, string> = {
  ACTIVATE: 'ACTIVE',
  ARCHIVE: 'ARCHIVED',
  DRAFT: 'DRAFT',
  PENDING_QC: 'PENDING_QC',
  REJECT: 'REJECTED',
};

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === 'string' && x.trim()) : [];
    const action = String(body.action || '').toUpperCase();

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No product ids provided' }, { status: 400 });
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 products per bulk action' }, { status: 400 });
    }

    // Hard delete is restricted to SUPER_ADMIN
    if (action === 'DELETE') {
      if (!requireRole(user, ['SUPER_ADMIN'])) {
        return NextResponse.json({ error: 'Only SUPER_ADMIN can hard-delete products. Use ARCHIVE instead.' }, { status: 403 });
      }
      // Soft check — products with orders should NOT be deleted.
      const referenced = await prisma.orderItem.findMany({
        where: { productId: { in: ids } },
        select: { productId: true },
        distinct: ['productId'],
      });
      const blocked = new Set(referenced.map(r => r.productId));
      const deletable = ids.filter(id => !blocked.has(id));

      if (deletable.length === 0) {
        return NextResponse.json({
          error: 'All selected products have order history. Archive them instead.',
          blockedCount: blocked.size,
        }, { status: 409 });
      }

      // Delete variants first, then products
      await prisma.variant.deleteMany({ where: { productId: { in: deletable } } });
      const result = await prisma.product.deleteMany({ where: { id: { in: deletable } } });

      return NextResponse.json({
        success: true,
        action: 'DELETE',
        deleted: result.count,
        skipped: blocked.size,
        skippedReason: blocked.size > 0 ? 'Products with order history cannot be hard-deleted; archive them instead.' : undefined,
      });
    }

    const newStatus = STATUS_MAP[action];
    if (!newStatus) {
      return NextResponse.json({
        error: `Unknown action "${action}". Allowed: ${Object.keys(STATUS_MAP).join(', ')}, DELETE`,
      }, { status: 400 });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status: newStatus as any },
    });

    return NextResponse.json({
      success: true,
      action,
      newStatus,
      updated: result.count,
      requested: ids.length,
    });
  } catch (e: any) {
    console.error('[admin.products.bulk] error:', e?.message, e?.stack);
    return NextResponse.json({ error: e.message || 'Bulk action failed' }, { status: 500 });
  }
}
