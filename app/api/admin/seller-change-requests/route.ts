// Admin queue for SellerChangeRequest.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  if (!requireRole(session, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const status = new URL(req.url).searchParams.get('status') || '';
    const where: any = {};
    if (status) where.status = status;

    const rows = await prisma.sellerChangeRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, businessName: true, slug: true } },
        supportingDocs: { select: { id: true, fileName: true, fileUrl: true, docType: true } },
      },
    });
    return NextResponse.json({ changeRequests: rows });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
