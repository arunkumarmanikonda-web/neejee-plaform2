// Loyalty members list — filterable by tier, sortable, paginated.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const tier = url.searchParams.get('tier');
    const search = url.searchParams.get('q');
    const sort = url.searchParams.get('sort') || 'lifetimeSpend';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

    const where: any = { role: 'CUSTOMER' };
    if (tier && tier !== 'ALL') where.loyaltyTier = tier;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { referralCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = sort === 'name' ? { name: 'asc' }
      : sort === 'points' ? { loyaltyPoints: 'desc' }
      : sort === 'recent' ? { updatedAt: 'desc' }
      : { lifetimeSpend: 'desc' };

    const members = await prisma.user.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true, name: true, email: true, phone: true,
        loyaltyTier: true, loyaltyPoints: true, lifetimePoints: true, lifetimeSpend: true,
        referralCode: true, createdAt: true,
        emailOptIn: true, whatsappOptIn: true, marketingConsent: true,
      },
    });

    return NextResponse.json({ members });
  } catch (e: any) {
    console.error('[admin/loyalty/members]', e);
    return NextResponse.json({ members: [], error: e.message }, { status: 200 });
  }
}
