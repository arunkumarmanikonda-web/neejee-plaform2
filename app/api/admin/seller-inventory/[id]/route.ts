// PATCH /api/admin/seller-inventory/{id}
// body: { action: 'review' | 'needs_info' | 'approve' | 'reject' | 'publish', note?, productOverrides? }
//
// review:    SUBMITTED → UNDER_REVIEW
// needs_info: → NEEDS_INFO (note required)
// reject:    → REJECTED (note required)
// approve:   → APPROVED   (does not yet publish — admin can polish first)
// publish:   → PUBLISHED + actually creates/updates the Product row
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const row = await prisma.sellerInventorySubmission.findUnique({
      where: { id: params.id },
      include: {
        seller: true,
        product: true,
      },
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ submission: row });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action: string = body.action;
    const note: string | undefined = body.note;
    const overrides: Record<string, any> = body.productOverrides || {};

    const sub = await prisma.sellerInventorySubmission.findUnique({
      where: { id: params.id },
      include: { product: true, seller: { select: { businessName: true, userId: true } } },
    });
    if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data = sub.proposedData as Record<string, any>;
    let updated: any = sub;
    let publishedProductId: string | null = null;

    switch (action) {
      case 'review':
        updated = await prisma.sellerInventorySubmission.update({
          where: { id: sub.id },
          data: { status: 'UNDER_REVIEW', reviewedByUserId: session!.id, reviewedAt: new Date() },
        });
        break;

      case 'needs_info':
        if (!note) return NextResponse.json({ error: 'note required' }, { status: 400 });
        updated = await prisma.sellerInventorySubmission.update({
          where: { id: sub.id },
          data: { status: 'NEEDS_INFO', reviewedByUserId: session!.id, reviewedAt: new Date(), reviewNote: note },
        });
        break;

      case 'reject':
        if (!note) return NextResponse.json({ error: 'note required' }, { status: 400 });
        updated = await prisma.sellerInventorySubmission.update({
          where: { id: sub.id },
          data: { status: 'REJECTED', reviewedByUserId: session!.id, reviewedAt: new Date(), reviewNote: note },
        });
        break;

      case 'approve':
        updated = await prisma.sellerInventorySubmission.update({
          where: { id: sub.id },
          data: { status: 'APPROVED', reviewedByUserId: session!.id, reviewedAt: new Date(), reviewNote: note || null },
        });
        break;

      case 'publish': {
        // Merge proposed data with admin overrides — admin polish layer.
        const final = { ...data, ...overrides };

        if (sub.submissionType === 'NEW_PRODUCT') {
          // Create a new Product row.
          // Seller SKU gets prefixed with seller slug for uniqueness.
          const sellerInfo = await prisma.seller.findUnique({
            where: { id: sub.sellerId },
            select: { slug: true, businessName: true },
          });
          const prefix = (sellerInfo?.slug || sub.sellerId.slice(0, 6)).toUpperCase();
          const sku = final.sku ? `${prefix}-${final.sku}` : `${prefix}-${Date.now()}`;
          const slug = final.slug || sku.toLowerCase();

          // Resolve category — admin override required
          if (!final.categoryId) {
            return NextResponse.json({
              error: 'categoryId required in productOverrides to publish',
            }, { status: 400 });
          }

          const created = await prisma.product.create({
            data: {
              slug,
              sku,
              name: final.name || 'Untitled',
              description: final.description || '',
              shortName: final.shortName || null,
              poeticLine: final.poeticLine || null,
              sellerId: sub.sellerId,
              ownershipModel: 'MARKETPLACE',
              categoryId: final.categoryId,
              material: final.material || null,
              technique: final.technique || null,
              occasion: final.occasion || null,
              region: final.region || null,
              craft: final.craft || null,
              state: final.state || null,
              cluster: final.cluster || null,
              artisanName: final.artisanName || null,
              mrp: parseInt(final.mrp) || 0,
              sellingPrice: parseInt(final.sellingPrice) || parseInt(final.mrp) || 0,
              salePrice: final.salePrice ? parseInt(final.salePrice) : null,
              gstRate: parseFloat(final.gstRate) || 5.0,
              hsnCode: final.hsnCode || null,
              images: Array.isArray(final.images) ? final.images : [],
              video: final.video || null,
              story: final.story || null,
              craftNote: final.craftNote || null,
              careInstructions: final.careInstructions || null,
              sustainabilityNote: final.sustainabilityNote || null,
              status: 'ACTIVE',
              codEligible: final.codEligible !== false,
              returnEligible: final.returnEligible !== false,
            },
          });
          publishedProductId = created.id;
        } else if (sub.productId) {
          // EDIT_EXISTING / PRICE_UPDATE / INVENTORY_UPDATE / TAKEDOWN_REQUEST
          const editable: any = {};
          if (sub.submissionType === 'TAKEDOWN_REQUEST') {
            editable.status = 'ARCHIVED';
            editable.takedownAt = new Date();
            editable.takedownReason = final.reason || 'Seller request';
            editable.takedownByUserId = session!.id;
          } else {
            // Whitelist editable fields
            const fields = ['name','description','shortName','poeticLine','material','technique','occasion','region','craft','mrp','sellingPrice','salePrice','images','story','craftNote','careInstructions'];
            for (const f of fields) if (f in final) editable[f] = final[f];
          }
          await prisma.product.update({
            where: { id: sub.productId },
            data: editable,
          });
          publishedProductId = sub.productId;
        }

        updated = await prisma.sellerInventorySubmission.update({
          where: { id: sub.id },
          data: { status: 'PUBLISHED', publishedAt: new Date(), reviewedByUserId: session!.id, reviewedAt: new Date() },
        });
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Audit + notify seller
    await prisma.sellerAuditLog.create({
      data: {
        sellerId: sub.sellerId,
        actorUserId: session!.id,
        actorRole: session!.role,
        action: `INVENTORY_${action.toUpperCase()}`,
        details: { submissionId: sub.id, note, publishedProductId } as any,
      },
    }).catch(() => {});

    try {
      const { notify } = await import('@/lib/notifications');
      const eventMap: Record<string, string> = {
        review: 'SELLER_INVENTORY_UNDER_REVIEW',
        needs_info: 'SELLER_INVENTORY_NEEDS_INFO',
        approve: 'SELLER_INVENTORY_APPROVED',
        reject: 'SELLER_INVENTORY_REJECTED',
        publish: 'SELLER_INVENTORY_PUBLISHED',
      };
      const evt = eventMap[action];
      if (evt && sub.seller.userId) {
        notify({
          event: evt as any,
          userId: sub.seller.userId,
          data: {
            productName: data?.name || sub.product?.name || 'your product',
            note: note || '',
            reviewerEmail: session!.email,
          },
          context: { type: 'SELLER_INVENTORY', id: sub.id },
        }).catch(() => {});
      }
    } catch { /* */ }

    return NextResponse.json({ submission: updated, publishedProductId });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    console.error('[admin.seller-inventory.patch]', err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
