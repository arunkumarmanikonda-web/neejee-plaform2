// /api/vendor/ai-photo-requests
// Vendor uploads raw shots + asks admin to generate studio imagery.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VENDOR_ROLES = ['VENDOR', 'VENDOR_STAFF'];

async function resolveVendor() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (!VENDOR_ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  const vendor = await prisma.vendor.findFirst({ where: { userId: session.id } });
  if (!vendor) return { error: NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 }) } as const;
  return { session, vendor } as const;
}

export async function GET() {
  const r = await resolveVendor();
  if ('error' in r) return r.error;
  const rows = await prisma.aiPhotoRequest.findMany({
    where: { vendorId: r.vendor.id },
    orderBy: { createdAt: 'desc' },
    include: { product: { select: { id: true, name: true, slug: true } } },
    take: 100,
  });
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const r = await resolveVendor();
  if ('error' in r) return r.error;
  try {
    const body = await req.json();
    const description = String(body.description || '').trim();
    const sourceImageUrls: string[] = Array.isArray(body.sourceImageUrls) ? body.sourceImageUrls : [];
    if (!description) return NextResponse.json({ error: 'description required' }, { status: 400 });
    if (sourceImageUrls.length === 0) return NextResponse.json({ error: 'at least one image required' }, { status: 400 });

    const row = await prisma.aiPhotoRequest.create({
      data: {
        vendorId: r.vendor.id,
        productId: body.productId || null,
        description: description.slice(0, 2000),
        proposedCategory: body.proposedCategory ? String(body.proposedCategory).slice(0, 100) : null,
        sourceImageUrls,
        requestedByUserId: r.session.id,
      },
    });

    // Notify admins
    try {
      const { notify } = await import('@/lib/notifications');
      const admins = await prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true },
      });
      for (const a of admins) {
        notify({
          event: 'PO_MESSAGE_RECEIVED', // reuse generic vendor→admin event (templates fallback covers it)
          userId: a.id,
          data: {
            poNumber: `AI-PHOTO-REQ-${row.id.slice(-6)}`,
            authorName: r.vendor.legalName,
            authorSide: 'vendor',
            vendorName: r.vendor.legalName,
            preview: description.slice(0, 200),
            link: `/admin/ai-photo-requests/${row.id}`,
          },
          context: { type: 'AI_PHOTO_REQUEST', id: row.id },
        } as any).catch(() => {});
      }
    } catch (e: any) {
      console.warn('[ai-photo-request notify]', e?.message);
    }

    return NextResponse.json({ ok: true, request: row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
