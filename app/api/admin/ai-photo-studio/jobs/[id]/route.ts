// /api/admin/ai-photo-studio/jobs/[id]
// GET    - job detail with variants
// DELETE - cancel/delete (only if not COMPLETED)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

async function gate() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!ADMIN_ROLES.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;
  const job = await prisma.aiPhotoJob.findUnique({
    where: { id: params.id },
    include: {
      variants: { orderBy: { createdAt: 'asc' } },
      product: { select: { id: true, name: true, slug: true, images: true } },
    },
  });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ job });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;
  const job = await prisma.aiPhotoJob.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (job.status === 'RUNNING') {
    return NextResponse.json({ error: 'Cannot delete a running job' }, { status: 400 });
  }
  await prisma.aiPhotoJob.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
