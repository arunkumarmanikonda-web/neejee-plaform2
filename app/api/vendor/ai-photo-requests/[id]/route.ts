// /api/vendor/ai-photo-requests/[id]
// GET    - request detail (with linked job + variants if completed)
// DELETE - vendor cancels their own request (only if SUBMITTED)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VENDOR_ROLES = ['VENDOR', 'VENDOR_STAFF'];

async function resolveVendor(reqId: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  if (!VENDOR_ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) } as const;
  }
  const vendor = await prisma.vendor.findFirst({ where: { userId: session.id } });
  if (!vendor) return { error: NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 }) } as const;
  const row = await prisma.aiPhotoRequest.findUnique({ where: { id: reqId } });
  if (!row || row.vendorId !== vendor.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  }
  return { session, vendor, row } as const;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await resolveVendor(params.id);
  if ('error' in r) return r.error;

  // If admin accepted and created a job, fetch its public-safe variant URLs
  let job: any = null;
  if (r.row.resultingJobId) {
    job = await prisma.aiPhotoJob.findUnique({
      where: { id: r.row.resultingJobId },
      select: {
        id: true,
        status: true,
        completedAt: true,
        variants: {
          select: { id: true, url: true, sceneType: true, sceneNote: true, decision: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }
  return NextResponse.json({ request: r.row, job });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const r = await resolveVendor(params.id);
  if ('error' in r) return r.error;
  if (r.row.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'Can only cancel SUBMITTED requests' }, { status: 400 });
  }
  await prisma.aiPhotoRequest.update({
    where: { id: params.id },
    data: { status: 'CANCELLED' },
  });
  return NextResponse.json({ ok: true });
}
