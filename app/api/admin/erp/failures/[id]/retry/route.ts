import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { planNextRetry } from '@/lib/erp/queue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const deadLetter = await tx.erpDeadLetter.findUnique({
        where: { id: (await context.params).id },
        include: { syncAttempt: true },
      });

      if (!deadLetter) {
        throw new Error('ERP dead-letter item not found');
      }

      if (deadLetter.status === 'RETRY_SCHEDULED') return { repeated: true as const, id: deadLetter.id };
      if (deadLetter.status === 'RESOLVED' || deadLetter.status === 'DISCARDED') {
        throw new Error('Only open items can be retried');
      }

      const retryPlan = planNextRetry({
        attemptNumber: deadLetter.syncAttempt.attemptNumber,
        maxAttempts: deadLetter.syncAttempt.maxAttempts,
      });

      if (retryPlan.shouldDeadLetter) {
        throw new Error('Maximum retry attempts already exhausted');
      }

      const claimed = await tx.erpDeadLetter.updateMany({
        where: { id: deadLetter.id, status: 'OPEN' },
        data: { status: 'RETRY_SCHEDULED', resolutionNote: null, resolvedAt: null },
      });
      if (!claimed.count) {
        const current = await tx.erpDeadLetter.findUnique({where:{id:deadLetter.id}});
        if (current?.status === 'RETRY_SCHEDULED') return { repeated: true as const, id: deadLetter.id };
        throw Error('The failure has already been closed');
      }
      const nextAttempt = await tx.erpSyncAttempt.create({
        data: {
          entityType: deadLetter.entityType,
          entityKey: deadLetter.entityKey,
          adapterKind: deadLetter.syncAttempt.adapterKind,
          action: deadLetter.syncAttempt.action,
          status: 'QUEUED',
          attemptNumber: retryPlan.nextAttemptNumber,
          maxAttempts: deadLetter.syncAttempt.maxAttempts,
          runAfter: new Date(retryPlan.runAfter),
          requestPayload: deadLetter.syncAttempt.requestPayload ?? undefined,
          meta: deadLetter.syncAttempt.meta ?? undefined,
        },
      });

      return {
        repeated: false as const,
        nextAttempt,
        id: deadLetter.id,
        retryPlan,
      };
    });

    if (result.repeated) return NextResponse.json({success:true,alreadyScheduled:true,deadLetterId:result.id});
    return NextResponse.json({
      success: true,
      retryAttemptId: result.nextAttempt.id,
      deadLetterId: result.id,
      scheduledFor: result.retryPlan.runAfter,
      delayMs: result.retryPlan.delayMs,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to schedule retry',
      },
      { status: 500 }
    );
  }
}
