// Admin single coupon - GET, PATCH, DELETE
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const data: any = {};
    if (body.code !== undefined) data.code = String(body.code).trim().toUpperCase();
    if (body.type !== undefined) data.type = body.type;
    if (body.value !== undefined) data.value = parseInt(body.value);
    if (body.minCart !== undefined) data.minCart = parseInt(body.minCart);
    if (body.maxDiscount !== undefined) data.maxDiscount = body.maxDiscount ? parseInt(body.maxDiscount) : null;
    if (body.maxUses !== undefined) data.maxUses = body.maxUses ? parseInt(body.maxUses) : null;
    if (body.validFrom !== undefined) data.validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
    if (body.validTo !== undefined) data.validTo = body.validTo ? new Date(body.validTo) : null;
    if (body.active !== undefined) data.active = !!body.active;

    const coupon = await prisma.coupon.update({ where: { id: params.id }, data });
    return NextResponse.json({ success: true, coupon });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await prisma.coupon.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
