// Admin single variant — PATCH update, DELETE
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: { id: string; vid: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const allowed = ['sku', 'size', 'color', 'colorHex', 'material', 'inventory', 'lowStockThreshold', 'mrp', 'sellingPrice', 'weight', 'images'];
    const data: any = {};
    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (['inventory', 'lowStockThreshold', 'mrp', 'sellingPrice'].includes(k)) {
          data[k] = body[k] === null || body[k] === '' ? null : parseInt(body[k]);
        } else if (k === 'weight') {
          data[k] = body[k] === null || body[k] === '' ? null : parseFloat(body[k]);
        } else {
          data[k] = body[k] || null;
        }
      }
    }
    const variant = await prisma.variant.update({ where: { id: params.vid }, data });
    return NextResponse.json({ success: true, variant });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string; vid: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.variant.delete({ where: { id: params.vid } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
