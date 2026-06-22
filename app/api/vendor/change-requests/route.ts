// GET /api/vendor/change-requests — vendor's own change requests with statuses
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'VENDOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const vendor = await prisma.vendor.findUnique({ where: { userId: session.id } });
  if (!vendor) return NextResponse.json({ error: 'No vendor profile' }, { status: 404 });

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;

  const requests = await prisma.vendorChangeRequest.findMany({
    where: { vendorId: vendor.id, ...(status ? { status: status as any } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { supportingDocs: { select: { id: true, docType: true, fileName: true, fileUrl: true, status: true } } },
  });
  return NextResponse.json({ requests });
}
