// Seller inventory submissions.
// GET  /api/seller/inventory-submissions          — list own
// POST /api/seller/inventory-submissions          — create new (NEW_PRODUCT, EDIT_EXISTING, etc.)
//   body: { submissionType, proposedData, productId?, sourceFileUrl?, sourceFileName? }
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext, canEditInventory } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set([
  'NEW_PRODUCT', 'EDIT_EXISTING', 'PRICE_UPDATE', 'INVENTORY_UPDATE', 'TAKEDOWN_REQUEST',
]);

export async function GET(req: Request) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const where: any = { sellerId: gate.ctx.seller.id };
    if (status) where.status = status;

    const rows = await prisma.sellerInventorySubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true, status: true } },
      },
    });
    return NextResponse.json({ submissions: rows });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (!canEditInventory(gate.ctx)) {
    return NextResponse.json({ error: 'You do not have inventory access for this studio' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { submissionType, proposedData, productId, sourceFileUrl, sourceFileName } = body;
    if (!submissionType || !ALLOWED_TYPES.has(submissionType)) {
      return NextResponse.json({ error: `submissionType required: one of ${Array.from(ALLOWED_TYPES).join(', ')}` }, { status: 400 });
    }
    if (!proposedData || typeof proposedData !== 'object') {
      return NextResponse.json({ error: 'proposedData is required' }, { status: 400 });
    }
    if ((submissionType === 'EDIT_EXISTING' || submissionType === 'PRICE_UPDATE' ||
         submissionType === 'INVENTORY_UPDATE' || submissionType === 'TAKEDOWN_REQUEST') && !productId) {
      return NextResponse.json({ error: 'productId required for this submission type' }, { status: 400 });
    }

    // If productId provided, verify it belongs to this seller
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { sellerId: true },
      });
      if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
      if (product.sellerId !== gate.ctx.seller.id) {
        return NextResponse.json({ error: 'This product belongs to a different studio' }, { status: 403 });
      }
    }

    const sub = await prisma.sellerInventorySubmission.create({
      data: {
        sellerId: gate.ctx.seller.id,
        submissionType: submissionType as any,
        proposedData,
        productId: productId || null,
        status: 'SUBMITTED',
        createdByUserId: session!.id,
        sourceFileUrl: sourceFileUrl || null,
        sourceFileName: sourceFileName || null,
      },
    });

    // Audit log
    await prisma.sellerAuditLog.create({
      data: {
        sellerId: gate.ctx.seller.id,
        actorUserId: session!.id,
        actorRole: gate.ctx.actorRole,
        action: 'INVENTORY_SUBMITTED',
        details: { submissionId: sub.id, submissionType, productId } as any,
      },
    }).catch(() => {});

    // Notify admins
    try {
      const { notify } = await import('@/lib/notifications');
      notify({
        event: 'SELLER_INVENTORY_SUBMITTED' as any,
        toAdmins: true,
        data: {
          sellerName: gate.ctx.seller.businessName,
          submissionType: submissionType.replace('_', ' '),
          productName: proposedData?.name || (productId ? 'existing product' : 'new product'),
        },
        context: { type: 'SELLER_INVENTORY', id: sub.id },
      }).catch(() => {});
    } catch { /* */ }

    return NextResponse.json({ submission: sub }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
