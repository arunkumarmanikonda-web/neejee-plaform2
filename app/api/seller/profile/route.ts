// GET  /api/seller/profile — full seller profile
// PATCH /api/seller/profile — edit. Approval-gated fields after first-time go through SellerChangeRequest.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext, canEditFinance, canEditInventory } from '@/lib/seller-auth-helpers';
import { APPROVAL_GATED_FIELDS, DIRECT_EDIT_FIELDS } from '@/lib/seller-profile';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const seller = await prisma.seller.findUnique({
      where: { id: gate.ctx.seller.id },
    });
    return NextResponse.json({ seller });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { ctx } = gate;

  try {
    const body = await req.json() as {
      changes: Record<string, any>;
      supportingDocIds?: string[];
      reason?: string;
    };
    const changes = body.changes || {};
    const supportingDocIds = body.supportingDocIds || [];
    const reason = body.reason || null;

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    // Load current seller for first-time-vs-edit logic
    const current = await prisma.seller.findUnique({ where: { id: ctx.seller.id } });
    if (!current) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

    // Split into direct vs gated
    const directChanges: Record<string, any> = {};
    const gatedChanges: Record<string, { from: any; to: any }> = {};
    const ignored: string[] = [];

    for (const [key, value] of Object.entries(changes)) {
      if (DIRECT_EDIT_FIELDS.has(key)) {
        // Permission: bank-restricted staff can't edit operational fields
        if (!ctx.isOwner && ctx.accessLevel === 'FINANCE_ONLY') {
          ignored.push(key); continue;
        }
        directChanges[key] = value;
      } else if (APPROVAL_GATED_FIELDS.has(key)) {
        const currentVal = (current as any)[key];
        // First-time entry = direct save (currentVal null/empty)
        const isFirstTime = currentVal === null || currentVal === undefined || currentVal === '';
        // Permission check: finance staff can edit bank fields, inventory staff cannot
        const isBankField = ['bankAccount', 'ifsc', 'bankName'].includes(key);
        const isComplianceField = ['pan', 'gstin', 'businessName', 'region'].includes(key);
        if (isBankField && !canEditFinance(ctx)) { ignored.push(key); continue; }
        if (isComplianceField && !ctx.isOwner && ctx.accessLevel !== 'FULL') {
          ignored.push(key); continue;
        }

        if (isFirstTime) {
          directChanges[key] = value;
        } else if (currentVal !== value) {
          gatedChanges[key] = { from: currentVal, to: value };
        }
      } else {
        ignored.push(key);
      }
    }

    // Apply direct changes immediately
    let updatedSeller = current;
    if (Object.keys(directChanges).length > 0) {
      updatedSeller = await prisma.seller.update({
        where: { id: ctx.seller.id },
        data: directChanges,
      });
      // Audit log
      await prisma.sellerAuditLog.create({
        data: {
          sellerId: ctx.seller.id,
          actorUserId: session!.id,
          actorRole: ctx.actorRole,
          action: 'PROFILE_DIRECT_EDIT',
          details: { fields: Object.keys(directChanges) } as any,
        },
      }).catch(() => {});
    }

    // Queue gated changes
    let changeRequest = null;
    if (Object.keys(gatedChanges).length > 0) {
      // Mandatory supporting doc for sensitive edits
      const hasDoc = supportingDocIds.length > 0;
      if (!hasDoc) {
        return NextResponse.json({
          error: 'Supporting document required for sensitive changes (PAN, GSTIN, bank, address, legal name)',
          gatedFields: Object.keys(gatedChanges),
        }, { status: 400 });
      }

      changeRequest = await prisma.sellerChangeRequest.create({
        data: {
          sellerId: ctx.seller.id,
          fieldChanges: gatedChanges as any,
          reason,
          status: 'PENDING',
          requestedByUserId: session!.id,
          requestedOnBehalf: false,
          supportingDocs: supportingDocIds.length > 0
            ? { connect: supportingDocIds.map(id => ({ id })) }
            : undefined,
        },
        include: { supportingDocs: true },
      });

      // Audit log
      await prisma.sellerAuditLog.create({
        data: {
          sellerId: ctx.seller.id,
          actorUserId: session!.id,
          actorRole: ctx.actorRole,
          action: 'CHANGE_REQUEST_SUBMITTED',
          details: { fields: Object.keys(gatedChanges), changeRequestId: changeRequest.id } as any,
        },
      }).catch(() => {});

      // Notify admins
      try {
        const { notify } = await import('@/lib/notifications');
        notify({
          event: 'SELLER_CHANGE_REQUEST_SUBMITTED' as any,
          toAdmins: true,
          data: {
            sellerName: current.businessName,
            fields: Object.keys(gatedChanges).join(', '),
            reason: reason || '',
          },
          context: { type: 'SELLER_CHANGE_REQUEST', id: changeRequest.id },
        }).catch(() => {});
      } catch { /* */ }
    }

    return NextResponse.json({
      seller: updatedSeller,
      changeRequest,
      ignored,
      message: changeRequest
        ? `${Object.keys(directChanges).length} field(s) updated, ${Object.keys(gatedChanges).length} sent for admin approval.`
        : 'Profile updated.',
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    console.error('[seller.profile]', err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
