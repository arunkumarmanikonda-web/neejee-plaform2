// GET /api/seller/change-requests — list for current seller.
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
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const rows = await prisma.sellerChangeRequest.findMany({
      where: { sellerId: gate.ctx.seller.id },
      include: { supportingDocs: { select: { id: true, fileName: true, fileUrl: true, docType: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ changeRequests: rows });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
