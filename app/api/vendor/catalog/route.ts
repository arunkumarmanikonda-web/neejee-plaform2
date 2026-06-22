// /api/vendor/catalog
// Vendor-portal endpoint: a vendor manages their own rate-card.
// GET   - list active items
// POST  - add new item
// PATCH - update item (must belong to this vendor)
// DELETE - soft-delete (active=false)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VENDOR_ROLES = ['VENDOR', 'VENDOR_STAFF'];

async function resolveVendor() {
  const session = await getSession();
  if (!session)
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (!VENDOR_ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  const vendor = await prisma.vendor.findFirst({ where: { userId: session.id } });
  if (!vendor)
    return { error: NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 }) } as const;
  return { session, vendor } as const;
}

export async function GET() {
  const r = await resolveVendor();
  if ('error' in r) return r.error;
  const items = await prisma.vendorCatalogItem.findMany({
    where: { vendorId: r.vendor.id, active: true },
    orderBy: { vendorSku: 'asc' },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const r = await resolveVendor();
  if ('error' in r) return r.error;
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
        vendorId: r.vendor.id,
        vendorSku,
        description,
        hsnCode: body.hsnCode ? String(body.hsnCode).trim() : null,
        unitCostPaise,
        gstRate: body.gstRate != null ? Number(body.gstRate) : 5.0,
        moq: body.moq ? Math.max(1, Math.round(Number(body.moq))) : 1,
        leadTimeDays: body.leadTimeDays ? Math.round(Number(body.leadTimeDays)) : null,
        notes: body.notes ? String(body.notes).trim() : null,
        createdByUserId: r.session.id,
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const r = await resolveVendor();
  if ('error' in r) return r.error;
  try {
    const body = await req.json();
    const itemId = String(body.itemId || '').trim();
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    const existing = await prisma.vendorCatalogItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.vendorId !== r.vendor.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const data: any = { lastUpdatedByUserId: r.session.id };
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.unitCostPaise !== undefined)
      data.unitCostPaise = Math.round(Number(body.unitCostPaise));
    if (body.gstRate !== undefined) data.gstRate = Number(body.gstRate);
    if (body.moq !== undefined) data.moq = Math.max(1, Math.round(Number(body.moq)));
    if (body.leadTimeDays !== undefined)
      data.leadTimeDays = body.leadTimeDays ? Math.round(Number(body.leadTimeDays)) : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
    if (body.hsnCode !== undefined) data.hsnCode = body.hsnCode ? String(body.hsnCode).trim() : null;
    const item = await prisma.vendorCatalogItem.update({ where: { id: itemId }, data });
    return NextResponse.json({ ok: true, item });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const r = await resolveVendor();
  if ('error' in r) return r.error;
  try {
    const url = new URL(req.url);
    const itemId = url.searchParams.get('itemId');
    if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });
    const existing = await prisma.vendorCatalogItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.vendorId !== r.vendor.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await prisma.vendorCatalogItem.update({
      where: { id: itemId },
      data: { active: false, lastUpdatedByUserId: r.session.id },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
