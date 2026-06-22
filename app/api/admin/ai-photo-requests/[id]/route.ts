// /api/admin/ai-photo-requests/[id]
// GET    - detail
// PATCH  - actions: ACCEPT (creates AiPhotoJob and runs it), REJECT, COMPLETE

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { runAiPhotoJob } from '@/lib/ai-photo-studio/generate';
import { detectStrategy, STRATEGIES, type StrategyKey } from '@/lib/ai-photo-studio/category-strategies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

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
  const row = await prisma.aiPhotoRequest.findUnique({
    where: { id: params.id },
    include: {
      vendor: { select: { id: true, legalName: true, contactEmail: true } },
      product: { select: { id: true, name: true, slug: true, category: { select: { name: true, slug: true } } } },
    },
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let job: any = null;
  if (row.resultingJobId) {
    job = await prisma.aiPhotoJob.findUnique({
      where: { id: row.resultingJobId },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });
  }
  return NextResponse.json({ request: row, job });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate();
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const row = await prisma.aiPhotoRequest.findUnique({ where: { id: params.id } });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.action === 'ACCEPT') {
      if (row.status !== 'SUBMITTED') {
        return NextResponse.json({ error: 'Request already actioned' }, { status: 400 });
      }
      // Resolve strategy
      let strategyKey: StrategyKey | null = body.strategy && STRATEGIES[body.strategy as StrategyKey]
        ? (body.strategy as StrategyKey)
        : null;
      if (!strategyKey && row.productId) {
        const product = await prisma.product.findUnique({
          where: { id: row.productId },
          select: {
            name: true,
            description: true,
            craft: true,
            category: { select: { slug: true, name: true } },
          },
        });
        if (product) {
          strategyKey = detectStrategy({
            categorySlug: product.category?.slug,
            categoryName: product.category?.name,
            productName: product.name,
            productDescription: product.description,
            craft: product.craft,
          });
        }
      }
      if (!strategyKey) {
        // Fall back to scanning the vendor's free-text description
        strategyKey = detectStrategy({
          categorySlug: row.proposedCategory,
          categoryName: row.proposedCategory,
          productName: row.description,
          productDescription: row.description,
        });
      }

      // Create the AiPhotoJob
      const job = await prisma.aiPhotoJob.create({
        data: {
          productId: row.productId,
          categorySlug: row.proposedCategory,
          strategy: strategyKey as any,
          sourceImageUrls: row.sourceImageUrls,
          variantCount: Math.min(Math.max(Number(body.variantCount || 6), 1), 6),
          modelArchetype: body.modelArchetype || 'mixed',
          stylePreset: body.stylePreset || 'editorial',
          addScaleShot: !!body.addScaleShot,
          requestedByUserId: g.session!.id,
          triggeredByRequestId: row.id,
          status: 'QUEUED',
        },
      });

      // Mark request accepted + linked
      await prisma.aiPhotoRequest.update({
        where: { id: row.id },
        data: {
          status: 'ACCEPTED',
          resultingJobId: job.id,
          reviewedAt: new Date(),
          reviewedByUserId: g.session!.id,
          adminNote: body.adminNote || null,
        },
      });

      // Run the job inline
      const result = await runAiPhotoJob(job.id);

      // Mark request COMPLETED if the job succeeded
      if (result.ok) {
        await prisma.aiPhotoRequest.update({
          where: { id: row.id },
          data: { status: 'COMPLETED' },
        });
      }

      // Notify the vendor
      try {
        const { notify } = await import('@/lib/notifications');
        const vendor = await prisma.vendor.findUnique({
          where: { id: row.vendorId },
          select: { userId: true, contactEmail: true, legalName: true },
        });
        const recipients = vendor?.userId
          ? { userId: vendor.userId }
          : vendor?.contactEmail
            ? { recipients: [{ email: vendor.contactEmail }] }
            : null;
        if (recipients) {
          notify({
            event: 'PO_MESSAGE_RECEIVED',
            ...recipients,
            data: {
              poNumber: `AI-PHOTO-${row.id.slice(-6)}`,
              authorName: 'NEEJEE Studio',
              authorSide: 'admin',
              preview: result.ok ? `${result.variantCount} variants ready for review` : `Generation failed: ${result.firstError}`,
              link: `/vendor/ai-photos`,
            },
            context: { type: 'AI_PHOTO_REQUEST', id: row.id },
          } as any).catch(() => {});
        }
      } catch (e: any) {
        console.warn('[ai-photo-request notify]', e?.message);
      }

      return NextResponse.json({ ok: true, jobId: job.id, result });
    }

    if (body.action === 'REJECT') {
      const note = String(body.adminNote || '').trim();
      if (!note) return NextResponse.json({ error: 'adminNote required for rejection' }, { status: 400 });
      await prisma.aiPhotoRequest.update({
        where: { id: row.id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedByUserId: g.session!.id,
          adminNote: note,
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    console.error('[ai-photo-request PATCH]', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
