// GET /api/admin/vendor-change-requests
// Global queue of pending vendor change requests across all vendors.
// Used on /admin/vendors/change-requests page.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'PENDING';

  const requests = await prisma.vendorChangeRequest.findMany({
    where: { status: status as any },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      vendor: { select: { id: true, legalName: true, displayName: true, contactEmail: true } },
      supportingDocs: { select: { id: true, docType: true, fileName: true, fileUrl: true, status: true } },
    },
  });
  return NextResponse.json({ requests });
}
