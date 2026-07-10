import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import {
  ERP_DASHBOARD_VERSION,
  buildAttemptDailySeries,
  normalizeRangeDays,
  startOfUtcDay,
  toCountMap,
  type ErpDashboardResponse,
} from '@/lib/erp/dashboard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const rangeDays = normalizeRangeDays(url.searchParams.get('days'));
  const now = new Date();
  const from = new Date(
    startOfUtcDay(now).getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000
  );

  try {
    const [
      attemptStatusRows,
      deadLetterStatusRows,
      entityRows,
      dailyAttemptRows,
      recentAttempts,
      recentDeadLetters,
    ] = await Promise.all([
      prisma.erpSyncAttempt.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
      }),
      prisma.erpDeadLetter.groupBy({
        by: ['status'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
      }),
      prisma.erpSyncAttempt.groupBy({
        by: ['entityType'],
        where: { createdAt: { gte: from } },
        _count: { _all: true },
      }),
      prisma.erpSyncAttempt.findMany({
        where: { createdAt: { gte: from } },
        select: {
          createdAt: true,
          status: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      prisma.erpSyncAttempt.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
        select: {
          id: true,
          entityType: true,
          entityKey: true,
          adapterKind: true,
          action: true,
          status: true,
          attemptNumber: true,
          maxAttempts: true,
          runAfter: true,
          startedAt: true,
          finishedAt: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.erpDeadLetter.findMany({
        orderBy: {
          updatedAt: 'desc',
        },
        take: 20,
        include: {
          syncAttempt: {
            select: {
              id: true,
              action: true,
              adapterKind: true,
              attemptNumber: true,
              maxAttempts: true,
              status: true,
              runAfter: true,
            },
          },
        },
      }),
    ]);

    const attemptCounts = toCountMap(attemptStatusRows as any[], 'status');
    const deadLetterCounts = toCountMap(deadLetterStatusRows as any[], 'status');

    const summary = {
      totalAttempts: dailyAttemptRows.length,
      queued: attemptCounts.QUEUED ?? 0,
      processing: attemptCounts.PROCESSING ?? 0,
      succeeded: attemptCounts.SUCCEEDED ?? 0,
      failed: attemptCounts.FAILED ?? 0,
      deadLetterAttempts: attemptCounts.DEAD_LETTER ?? 0,
      openDeadLetters: deadLetterCounts.OPEN ?? 0,
      retryScheduledDeadLetters: deadLetterCounts.RETRY_SCHEDULED ?? 0,
      resolvedDeadLetters: deadLetterCounts.RESOLVED ?? 0,
      discardedDeadLetters: deadLetterCounts.DISCARDED ?? 0,
    };

    const daily = buildAttemptDailySeries(dailyAttemptRows, rangeDays, now);

    const byEntity = (entityRows as any[])
      .map((row) => ({
        entityType: String(row.entityType),
        count: row._count?._all ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.entityType.localeCompare(b.entityType));

    const payload: ErpDashboardResponse = {
      version: ERP_DASHBOARD_VERSION,
      rangeDays,
      summary,
      daily,
      byEntity,
      recentAttempts: recentAttempts.map((row) => ({
        id: row.id,
        entityType: String(row.entityType),
        entityKey: row.entityKey,
        adapterKind: row.adapterKind,
        action: row.action,
        status: String(row.status),
        attemptNumber: row.attemptNumber,
        maxAttempts: row.maxAttempts,
        runAfter: row.runAfter.toISOString(),
        startedAt: row.startedAt ? row.startedAt.toISOString() : null,
        finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        createdAt: row.createdAt.toISOString(),
      })),
      recentDeadLetters: recentDeadLetters.map((row) => ({
        id: row.id,
        entityType: String(row.entityType),
        entityKey: row.entityKey,
        status: String(row.status),
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        resolutionNote: row.resolutionNote,
        lastFailedAt: row.lastFailedAt.toISOString(),
        resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        syncAttempt: {
          id: row.syncAttempt.id,
          action: row.syncAttempt.action,
          adapterKind: row.syncAttempt.adapterKind,
          attemptNumber: row.syncAttempt.attemptNumber,
          maxAttempts: row.syncAttempt.maxAttempts,
          status: String(row.syncAttempt.status),
          runAfter: row.syncAttempt.runAfter.toISOString(),
        },
      })),
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to load ERP dashboard',
        version: ERP_DASHBOARD_VERSION,
        rangeDays,
        summary: {
          totalAttempts: 0,
          queued: 0,
          processing: 0,
          succeeded: 0,
          failed: 0,
          deadLetterAttempts: 0,
          openDeadLetters: 0,
          retryScheduledDeadLetters: 0,
          resolvedDeadLetters: 0,
          discardedDeadLetters: 0,
        },
        daily: [],
        byEntity: [],
        recentAttempts: [],
        recentDeadLetters: [],
      },
      { status: 500 }
    );
  }
}
