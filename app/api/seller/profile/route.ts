import type { Seller } from '@prisma/client';
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

function profileForAccess(seller: Seller, finance: boolean) {
  const { id, slug, businessName, contactName, email, phone, story, logoImage, coverImage, portfolio, region, craft, cluster, yearsOfPractice,
    kycStatus, isNeejeeSelect, qualityScore, commissionPct, pan, gstin, bankAccount, ifsc, bankName } = seller;
  return { id, slug, businessName, contactName, email, phone, story, logoImage, coverImage, portfolio, region, craft, cluster, yearsOfPractice,
    kycStatus, isNeejeeSelect, qualityScore, commissionPct, ...(finance && { pan, gstin, bankAccount, ifsc, bankName }) };
}

export async function GET() {
  const session = await getSession();
  const gate = await requireSellerContext(session);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const seller = await prisma.seller.findUnique({
      where: { id: gate.ctx.seller.id },
    });
    if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    return NextResponse.json({ seller: profileForAccess(seller, canEditFinance(gate.ctx)) });
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
    const supportingDocIds = [...new Set((Array.isArray(body.supportingDocIds) ? body.supportingDocIds : []).filter(id => typeof id === 'string'))];
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

    const needsReview = Object.keys(gatedChanges).length > 0;
    if (needsReview && !supportingDocIds.length) return NextResponse.json({ error: 'A supporting document is required for this change.' }, { status: 400 });
    if (needsReview) {
      const valid = await prisma.sellerDocument.count({ where: { sellerId: ctx.seller.id, id: { in: supportingDocIds }, changeRequestId: null } });
      if (valid !== supportingDocIds.length) return NextResponse.json({ error: 'Select available documents from your studio.' }, { status: 400 });
    }
    const { updatedSeller, changeRequest } = await prisma.$transaction(async tx => {
      const updatedSeller = Object.keys(directChanges).length
        ? await tx.seller.update({ where: { id: ctx.seller.id }, data: directChanges }) : current;
      if (Object.keys(directChanges).length) await tx.sellerAuditLog.create({ data: {
        sellerId: ctx.seller.id, actorUserId: session!.id, actorRole: ctx.actorRole,
        action: 'PROFILE_DIRECT_EDIT', details: { fields: Object.keys(directChanges) },
      } });
      if (!needsReview) return { updatedSeller, changeRequest: null };
      const changeRequest = await tx.sellerChangeRequest.create({ data: {
        sellerId: ctx.seller.id, fieldChanges: gatedChanges, reason, status: 'PENDING', requestedByUserId: session!.id,
        supportingDocs: { connect: supportingDocIds.map(id => ({ id, sellerId: ctx.seller.id, changeRequestId: null })) },
      }, include: { supportingDocs: true } });
      await tx.sellerAuditLog.create({ data: { sellerId: ctx.seller.id, actorUserId: session!.id, actorRole: ctx.actorRole,
        action: 'CHANGE_REQUEST_SUBMITTED', details: { fields: Object.keys(gatedChanges), changeRequestId: changeRequest.id } } });
      return { updatedSeller, changeRequest };
    });
    if (changeRequest) {
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
      seller: profileForAccess(updatedSeller, canEditFinance(ctx)),
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
