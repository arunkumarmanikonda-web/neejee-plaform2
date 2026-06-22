// v23.38 — Universal finance audit log helper.
// Call recordAudit() from every finance API route after a successful write.
//
// Usage:
//   const before = await prisma.bill.findUnique({ where: { id } });
//   const after  = await prisma.bill.update({ where: { id }, data: changes });
//   await recordAudit({ action: 'UPDATE', entityType: 'Bill', entityId: id, before, after, session, req });
//
// For CREATE:   recordAudit({ action: 'CREATE', entityType: 'Bill', entityId: created.id, after: created, ... });
// For DELETE:   recordAudit({ action: 'DELETE', entityType: 'Bill', entityId: id, before: snapshot, ... });

import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/auth';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

interface RecordAuditOpts {
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: any;
  after?: any;
  session?: SessionUser | null;
  req?: Request;
}

/** Compute a field-level diff between `before` and `after`. Returns null when no changes. */
function diff(before: any, after: any): Record<string, { from: any; to: any }> | null {
  if (!before || !after) return null;
  const out: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of Array.from(keys)) {
    const v1 = before[k];
    const v2 = after[k];
    // Compare loosely: stringify scalars + dates; skip Prisma relations (objects with .id pattern)
    const s1 = serialize(v1);
    const s2 = serialize(v2);
    if (s1 !== s2) {
      out[k] = { from: v1, to: v2 };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function serialize(v: any): string {
  if (v == null) return 'null';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function safeSnapshot(row: any): string {
  try {
    return JSON.stringify(row, (_k, v) => {
      if (v instanceof Date) return v.toISOString();
      return v;
    });
  } catch {
    return '{}';
  }
}

export async function recordAudit(opts: RecordAuditOpts): Promise<void> {
  try {
    const { action, entityType, entityId, before, after, session, req } = opts;
    const changesJson =
      action === 'UPDATE'
        ? JSON.stringify(diff(before, after) || {})
        : null;
    const fullSnapshot =
      action === 'CREATE' ? safeSnapshot(after) :
      action === 'DELETE' ? safeSnapshot(before) :
      null;

    const ipAddress = req?.headers.get('x-forwarded-for')?.split(',')[0]
      || req?.headers.get('x-real-ip')
      || undefined;
    const userAgent = req?.headers.get('user-agent') || undefined;

    await prisma.financeAuditLog.create({
      data: {
        action,
        entityType,
        entityId,
        changesJson,
        fullSnapshot,
        userId: session?.id || null,
        userEmail: session?.email || null,
        userRole: session?.role || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (e: any) {
    // Audit failures should NEVER break a finance operation.
    // Log to console for ops investigation but swallow the error.
    console.warn('[FinanceAuditLog] recording failed:', e?.message);
  }
}

/** Convenience: fetch audit history for a specific entity, newest first. */
export async function getAuditHistory(entityType: string, entityId: string, limit = 100) {
  return prisma.financeAuditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
