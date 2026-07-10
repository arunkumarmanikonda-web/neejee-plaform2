import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getSession();

  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get('status') || 'ALL').toUpperCase();

  try {
    const where =
      status === 'ALL'
        ? {}
        : {
            status: status as any,
          };

    const rows = await prisma.erpDeadLetter.findMany({
      where,
      include: {
        syncAttempt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 100,
    });

    const failures = rows.map((row) => ({
      id: row.id,
      entityType: row.entityType,
      entityKey: row.entityKey,
      status: row.status,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastFailedAt: row.lastFailedAt.toISOString(),
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
      syncAttempt: {
        id: row.syncAttempt.id,
        action: row.syncAttempt.action,
        adapterKind: row.syncAttempt.adapterKind,
        attemptNumber: row.syncAttempt.attemptNumber,
        maxAttempts: row.syncAttempt.maxAttempts,
        status: row.syncAttempt.status,
        runAfter: row.syncAttempt.runAfter.toISOString(),
      },
    }));

    const stats = {
      total: failures.length,
      open: failures.filter((item) => item.status === 'OPEN').length,
      retryScheduled: failures.filter((item) => item.status === 'RETRY_SCHEDULED').length,
      resolved: failures.filter((item) => item.status === 'RESOLVED').length,
      discarded: failures.filter((item) => item.status === 'DISCARDED').length,
    };

    return NextResponse.json({
      failures,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'Failed to load ERP failures',
        failures: [],
        stats: {
          total: 0,
          open: 0,
          retryScheduled: 0,
          resolved: 0,
          discarded: 0,
        },
      },
      { status: 500 }
    );
  }
}
