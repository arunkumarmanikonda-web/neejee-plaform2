// Admin sellers list endpoint
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const sellers = await prisma.seller.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { products: { select: { id: true } } },
    });
    return NextResponse.json({
      sellers: sellers.map((s: any) => ({
        id: s.id,
        businessName: s.businessName,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        craft: s.craft,
        region: s.region,
        kycStatus: s.kycStatus,
        qualityScore: s.qualityScore,
        commissionPct: s.commissionPct,
        isNeejeeSelect: s.isNeejeeSelect,
        productCount: s.products.length,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, sellers: [] }, { status: 500 });
  }
}
