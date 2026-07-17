import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireSellerContext } from '@/lib/seller-auth-helpers';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();
  const gate = await requireSellerContext(session);

  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    const agreements = await prisma.sellerAgreement.findMany({
      where: { sellerId: gate.ctx.seller.id },
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        status: true,
        currentVersionNo: true,
        createdAt: true,
        updatedAt: true,
        sellerSignedAt: true,
        companySignedAt: true,
      },
    });

    return NextResponse.json({
      agreements,
      seller: gate.ctx.seller,
    });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message, code: m.code }, { status: m.status });
  }
}