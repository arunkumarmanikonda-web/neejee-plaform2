// /api/admin/vendors/[id]/catalog
// GET    - list a vendor's rate-card items
// POST   - add a new rate-card item
// PATCH  - update an existing item (body.itemId required)
// DELETE - remove an item (body.itemId required)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const READ_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN'];

async function gate(write = false) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const allowed = write ? WRITE_ROLES : READ_ROLES;
  if (!allowed.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate(false);
  if (g.error) return g.error;
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get('inactive') === '1';

  const items = await prisma.vendorCatalogItem.findMany({
    where: {
      vendorId: params.id,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ active: 'desc' }, { vendorSku: 'asc' }],
    include: { product: { select: { id: true, name: true, slug: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate(true);
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const vendorSku = String(body.vendorSku || '').trim();
    const description = String(body.description || '').trim();
    if (!vendorSku || !description) {
      return NextResponse.json({ error: 'vendorSku and description required' }, { status: 400 });
    }
    const unitCostPaise = Math.round(Number(body.unitCostPaise || 0));
    if (unitCostPaise <= 0) {
      return NextResponse.json({ error: 'unitCostPaise must be > 0' }, { status: 400 });
    }

    const item = await prisma.vendorCatalogItem.create({
      data: {
        vendorId: params.id,
        vendorSku,
        description,
        hsnCode: body.hsnCode ? String(body.hsnCode).trim() : null,
        productId: body.productId || null,
        unitCostPaise,
        gstRate: body.gstRate != null ? Number(body.gstRate) : 5.0,
        moq: body.moq ? Math.max(1, Math.round(Number(body.moq))) : 1,
        leadTimeDays: body.leadTimeDays ? Math.round(Number(body.leadTimeDays)) : null,
        notes: body.notes ? String(body.notes).trim() : null,
        imageUrl: body.imageUrl || null,
        validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        createdByUserId: g.session!.id,
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A catalog item with this vendor SKU already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate(true);
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const itemId = String(body.itemId || '').trim();
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

    const data: any = { lastUpdatedByUserId: g.session!.id };
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.hsnCode !== undefined) data.hsnCode = body.hsnCode ? String(body.hsnCode).trim() : null;
    if (body.unitCostPaise !== undefined)
      data.unitCostPaise = Math.round(Number(body.unitCostPaise));
    if (body.gstRate !== undefined) data.gstRate = Number(body.gstRate);
    if (body.moq !== undefined) data.moq = Math.max(1, Math.round(Number(body.moq)));
    if (body.leadTimeDays !== undefined)
      data.leadTimeDays = body.leadTimeDays ? Math.round(Number(body.leadTimeDays)) : null;
    if (body.active !== undefined) data.active = !!body.active;
    if (body.productId !== undefined) data.productId = body.productId || null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl || null;
    if (body.validUntil !== undefined)
      data.validUntil = body.validUntil ? new Date(body.validUntil) : null;

    const item = await prisma.vendorCatalogItem.update({
      where: { id: itemId },
      data,
    });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params: _p }: { params: { id: string } }) {
  const g = await gate(true);
  if (g.error) return g.error;
  try {
    const url = new URL(req.url);
    const itemId = url.searchParams.get('itemId');
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    // Soft-delete by setting active=false (preserves PO line history).
    await prisma.vendorCatalogItem.update({
      where: { id: itemId },
      data: { active: false, lastUpdatedByUserId: g.session!.id },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
