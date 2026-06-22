// app/api/checkout/abandon/route.ts
// v26.3a — Beacon target for client-side beforeunload/pagehide.
// Marks the AbandonedCart snapshot's lastSeenStep and refreshes nextActionAt.
// The cron picks up rows where nextActionAt <= now AND recoveredOrderId IS NULL.
//
// Idempotent. No-op if snapshot already recovered or doesn't exist.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try { body = await request.json(); } catch { /* sendBeacon may send empty */ }

    const { snapshotId, step } = body;
    if (!snapshotId) {
      return NextResponse.json({ ok: false, error: 'snapshotId required' }, { status: 400 });
    }

    // Load settings for the grace period
    const settings = await prisma.recoverySettings.findUnique({
      where: { id: 'default' },
    } as any).catch(() => null);

    const cadence = (settings as any)?.cadenceHours || { stage1: 1 };
    const graceMinutes = (settings as any)?.abandonGraceMinutes || 30;

    // Only update if snapshot still ACTIVE (no order yet)
    const snapshot = await prisma.abandonedCart.findUnique({
      where: { id: snapshotId },
    });
    if (!snapshot) return NextResponse.json({ ok: true, ignored: 'not found' });
    if (snapshot.recoveredOrderId) return NextResponse.json({ ok: true, ignored: 'already converted' });
    if (snapshot.optedOut) return NextResponse.json({ ok: true, ignored: 'opted out' });

    // Compute next action: stage 1 hours after grace minutes
    const nextActionAt = new Date(Date.now() + Math.max(graceMinutes, cadence.stage1 * 60) * 60 * 1000);

    await prisma.abandonedCart.update({
      where: { id: snapshotId },
      data: {
        lastSeenStep: step || 'payment',
        recoveryStage: 0,
        nextActionAt,
      } as any,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Beacon must never throw — return 200 even on internal errors
    console.warn('[checkout.abandon]', e?.message);
    return NextResponse.json({ ok: true, suppressed: true });
  }
}
