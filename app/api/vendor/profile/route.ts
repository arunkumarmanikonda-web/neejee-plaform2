// GET /api/vendor/profile      — vendor's own profile + pending change requests
// PATCH /api/vendor/profile    — update fields. Direct-edit fields apply
//                                 immediately; sensitive fields create a
//                                 VendorChangeRequest awaiting admin review.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import {
  APPROVAL_GATED_FIELDS, DIRECT_EDIT_FIELDS,
  FIELD_TO_REQUIRED_DOC_TYPES, isEmptyValue,
} from '@/lib/vendor-profile';
import { notify } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function vendorGate() {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') return { error: 'Unauthorized', status: 401 };
  const vendor = await prisma.vendor.findUnique({
    where: { userId: session.id },
    include: { user: { select: { passwordHash: true } } },
  });
  if (!vendor) return { error: 'No vendor profile', status: 404 };
  return { session, vendor };
}

export async function GET() {
  const g = await vendorGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  try {
    const pendingRequests = await prisma.vendorChangeRequest.findMany({
      where: { vendorId: g.vendor.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: { supportingDocs: { select: { id: true, docType: true, fileName: true, fileUrl: true, status: true } } },
    });
    // hasPassword = boolean only, don't leak the hash
    const { user, ...vendorPublic } = g.vendor;
    return NextResponse.json({
      vendor: { ...vendorPublic, hasPassword: !!user?.passwordHash },
      pendingRequests,
    });
  } catch (e: any) {
    console.error('[vendor/profile GET]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}

// PATCH body:
//   { fields: { displayName?, contactPerson?, contactPhone?, ... },
//     reason?: string,
//     supportingDocIds?: string[]  // required if any APPROVAL_GATED_FIELDS are present
//   }
export async function PATCH(request: Request) {
  const g = await vendorGate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: any = {};
  try { body = await request.json(); } catch {}
  const incoming = body?.fields || {};
  if (typeof incoming !== 'object' || Array.isArray(incoming)) {
    return NextResponse.json({ error: 'fields must be an object' }, { status: 400 });
  }

  // Split incoming fields into direct vs gated, and detect first-time fills.
  const directUpdate: Record<string, any> = {};
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

  for (const [field, newValue] of Object.entries(incoming)) {
    const oldValue = (g.vendor as any)[field];
    const normalizedNew = newValue === '' ? null : newValue;
    if (oldValue === normalizedNew) continue;  // no change

    if ((DIRECT_EDIT_FIELDS as readonly string[]).includes(field)) {
      directUpdate[field] = normalizedNew;
      continue;
    }
    if ((APPROVAL_GATED_FIELDS as readonly string[]).includes(field)) {
      // First-time fill (old was empty) → direct save, no approval needed.
      if (isEmptyValue(oldValue)) {
        directUpdate[field] = normalizedNew;
      } else {
        // Real edit → goes into the change request
        changes.push({ field, oldValue, newValue: normalizedNew });
      }
      continue;
    }
    // Unknown field — ignore silently
  }

  try {
    // Apply direct updates first (no docs needed for these)
    if (Object.keys(directUpdate).length > 0) {
      await prisma.vendor.update({ where: { id: g.vendor.id }, data: directUpdate });
      await prisma.vendorAuditLog.create({
        data: {
          vendorId: g.vendor.id,
          actorUserId: g.session.id,
          actorRole: 'VENDOR',
          action: 'PROFILE_DIRECT_EDIT',
          details: { fields: Object.keys(directUpdate) },
        },
      });
    }

    // Create a change request for gated fields
    let changeRequestId: string | null = null;
    if (changes.length > 0) {
      const supportingDocIds: string[] = Array.isArray(body?.supportingDocIds) ? body.supportingDocIds : [];
      if (supportingDocIds.length === 0) {
        return NextResponse.json({
          error: 'A supporting document is required to change sensitive fields. Upload a document first, then submit the change.',
          requiredDocsForFields: changes.reduce((acc, c) => {
            acc[c.field] = FIELD_TO_REQUIRED_DOC_TYPES[c.field as keyof typeof FIELD_TO_REQUIRED_DOC_TYPES] || [];
            return acc;
          }, {} as Record<string, string[]>),
        }, { status: 400 });
      }
      // Validate the docs belong to this vendor
      const docs = await prisma.vendorDocument.findMany({
        where: { id: { in: supportingDocIds }, vendorId: g.vendor.id },
      });
      if (docs.length === 0) {
        return NextResponse.json({ error: 'Supporting documents not found' }, { status: 400 });
      }
      const cr = await prisma.vendorChangeRequest.create({
        data: {
          vendorId: g.vendor.id,
          fieldChanges: changes as any,
          reason: body?.reason || null,
          status: 'PENDING',
          requestedByUserId: g.session.id,
          requestedOnBehalf: false,
        },
      });
      // Link the docs
      await prisma.vendorDocument.updateMany({
        where: { id: { in: docs.map(d => d.id) } },
        data: { changeRequestId: cr.id },
      });
      changeRequestId = cr.id;
      await prisma.vendorAuditLog.create({
        data: {
          vendorId: g.vendor.id,
          actorUserId: g.session.id,
          actorRole: 'VENDOR',
          action: 'CHANGE_REQUESTED',
          details: { changeRequestId: cr.id, fields: changes.map(c => c.field) },
        },
      });
      // Notify all admins so they can review the request
      notify({
        event: 'CHANGE_REQUEST_SUBMITTED',
        toAdmins: true,
        data: {
          vendorName: g.vendor.displayName || g.vendor.legalName,
          fields: changes.map(c => c.field),
          changeRequestId: cr.id,
        },
        context: { type: 'VENDOR_CHANGE_REQUEST', id: cr.id },
      }).catch(e => console.warn('[notify CHANGE_REQUEST_SUBMITTED]', e));
    }

    return NextResponse.json({
      ok: true,
      directApplied: Object.keys(directUpdate),
      changeRequestId,
      pendingFields: changes.map(c => c.field),
    });
  } catch (e: any) {
    console.error('[vendor/profile PATCH]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}
