// Admin coupons - list & create
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { validFrom: 'desc' }, take: 200 });
    return NextResponse.json({ coupons });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, coupons: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    if (!body.code || !body.type) return NextResponse.json({ error: 'code and type required' }, { status: 400 });
    if (!['PERCENT', 'FLAT', 'FREE_SHIPPING'].includes(body.type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    const coupon = await prisma.coupon.create({
      data: {
        code: String(body.code).trim().toUpperCase(),
        type: body.type,
        value: parseInt(body.value || 0),
        minCart: parseInt(body.minCart || 0),
        maxDiscount: body.maxDiscount ? parseInt(body.maxDiscount) : null,
        maxUses: body.maxUses ? parseInt(body.maxUses) : null,
        validFrom: body.validFrom ? new Date(body.validFrom) : new Date(),
        validTo: body.validTo ? new Date(body.validTo) : null,
        active: body.active !== false,
      },
    });
    return NextResponse.json({ success: true, coupon });
  } catch (e: any) {
    const msg = e.code === 'P2002' ? 'Coupon code already exists' : e.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
