// /api/admin/ai-photo-studio/jobs/[id]/regenerate
// POST - create a fresh AiPhotoJob copying source images & options from the
// original, with optional feedback note. Useful when results were unsatisfactory.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { runAiPhotoJob } from '@/lib/ai-photo-studio/generate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ADMIN_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const original = await prisma.aiPhotoJob.findUnique({ where: { id: params.id } });
    if (!original) return NextResponse.json({ error: 'Original job not found' }, { status: 404 });

    // Allow overriding strategy, model, style etc. — falls back to original values.
    const newJob = await prisma.aiPhotoJob.create({
      data: {
        productId: original.productId,
        categorySlug: original.categorySlug,
        strategy: (body.strategy || original.strategy) as any,
        sourceImageUrls: original.sourceImageUrls,
        variantCount: Math.min(Math.max(Number(body.variantCount || original.variantCount), 1), 6),
        modelArchetype: body.modelArchetype || original.modelArchetype,
        stylePreset: body.stylePreset || original.stylePreset,
        addScaleShot: body.addScaleShot ?? original.addScaleShot,
        regenerationFeedback: body.feedback ? String(body.feedback).slice(0, 2000) : null,
        requestedByUserId: session.id,
        status: 'QUEUED',
      },
    });

    const result = await runAiPhotoJob(newJob.id);
    return NextResponse.json({ ok: result.ok, jobId: newJob.id, result });
  } catch (e: any) {
    console.error('[ai-photo regenerate]', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
