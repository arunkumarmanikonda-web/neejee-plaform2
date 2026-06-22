// /api/cron/forecast — daily refresh of all forecasts + stock-out warnings.
// Schedule via vercel.json: { "path":"/api/cron/forecast", "schedule":"0 2 * * *" }
// (02:00 UTC = 07:30 IST)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { refreshAllForecasts } from '@/lib/forecast/compute';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Auth: Bearer CRON_SECRET (set in Vercel env)
  const auth = req.headers.get('authorization') || '';
  const expected = process.env.CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startedAt = new Date();
    const result = await refreshAllForecasts();

    // Fire stockout warnings (one digest email to admins)
    if (result.stockoutWarnings.length > 0) {
      try {
        const { notify } = await import('@/lib/notifications');
        const admins = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
          select: { id: true },
        });
        const summary = result.stockoutWarnings
          .slice(0, 10)
          .map(w => `• ${w.productName}: stockout in ~${w.days}d`)
          .join('\n');
        for (const a of admins) {
          notify({
            event: 'FORECAST_STOCKOUT_WARNING',
            userId: a.id,
            data: {
              count: result.stockoutWarnings.length,
              firstFew: summary,
              link: '/admin/forecast?scope=PRODUCT',
            },
            context: { type: 'FORECAST', id: 'daily' },
          } as any).catch(() => {});
        }
      } catch (e: any) {
        console.warn('[cron forecast] notify:', e?.message);
      }
    }

    return NextResponse.json({
      ok: true,
      ranAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      ...result,
    });
  } catch (e: any) {
    console.error('[cron forecast] error:', e);
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
