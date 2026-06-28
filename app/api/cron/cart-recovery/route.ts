// app/api/cron/cart-recovery/route.ts
// v26.3c — Multi-channel recovery cron.
// Reads RecoverySettings.channelMatrix to decide which channels fire per stage.
// Email still goes through existing email templates; SMS/WA route through the
// notification dispatcher.
//
// Hardened rules:
// - Recovery messaging uses verifiedItems only
// - Empty/invalid snapshots are marked inert and skipped

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { generateRecoveryCopy } from '@/lib/recovery/ai-copy';
import { ensureStageCoupon } from '@/lib/recovery/discount';
import { recoveryT1hEmail } from '@/lib/email/templates/recovery-t1h';
import { recoveryT24hEmail } from '@/lib/email/templates/recovery-t24h';
import { recoveryT72hEmail } from '@/lib/email/templates/recovery-t72h';
import { telecallerHandoffEmail } from '@/lib/email/templates/telecaller-handoff';
import { dispatchSms, dispatchWhatsApp } from '@/lib/notifications/dispatcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const HOURS = 60 * 60 * 1000;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    console.warn('[cron] CRON_SECRET not set — refusing');
    return false;
  }
  const got = req.headers.get('authorization') || '';
  return got === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return run();
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return run();
}

function firstName(name?: string | null): string {
  return name?.split(' ')[0] || 'friend';
}

function parseRecoverySnapshot(itemsJson: string) {
  try {
    const data = JSON.parse(itemsJson || '{}');
    const verifiedItems = Array.isArray(data?.verifiedItems) ? data.verifiedItems : [];
    return { data, verifiedItems };
  } catch {
    return { data: null, verifiedItems: [] };
  }
}

async function run() {
  const startedAt = Date.now();
  const settings = await prisma.recoverySettings.findUnique({ where: { id: 'default' } } as any).catch(() => null);
  const cadence  = (settings as any)?.cadenceHours       || { stage1: 1, stage2: 24, stage3: 72, stage4: 168 };
  const percents = (settings as any)?.discountPercents   || { stage2: 10, stage3: 15 };
  const matrix   = (settings as any)?.channelMatrix      || {
    stage1: { email: true, sms: false, whatsapp: false },
    stage2: { email: true, sms: false, whatsapp: true },
    stage3: { email: true, sms: false, whatsapp: true },
    stage4: { email: true, sms: true,  whatsapp: false },
  };
  const aiEnabled       = (settings as any)?.aiEnabled ?? true;
  const handoffEnabled  = (settings as any)?.telecallerHandoffEnabled ?? true;
  const graceMinutes    = (settings as any)?.abandonGraceMinutes || 30;

  const now = new Date();
  const graceThreshold = new Date(now.getTime() - graceMinutes * 60 * 1000);

  const due = await prisma.abandonedCart.findMany({
    where: {
      recoveredOrderId: null,
      optedOut: false,
      nextActionAt: { lte: now },
      createdAt: { lte: graceThreshold },
      recoveryStage: { lt: 4 },
    } as any,
    orderBy: { nextActionAt: 'asc' } as any,
    take: 100,
  });

  const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://neejee.com';
  const results: any[] = [];

  for (const cart of due) {
    try {
      const stage = (cart.recoveryStage + 1) as 1 | 2 | 3 | 4;
      const stageKey = `stage${stage}`;
      const stageMatrix = (matrix as any)[stageKey] || {};

      const { verifiedItems: snapshotItems } = parseRecoverySnapshot(cart.itemsJson);

      if (snapshotItems.length === 0) {
        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: {
            nextActionAt: null,
            lastRemindedAt: now,
            lastSeenStep: 'invalid_snapshot',
            telecallerStatus: 'invalid_snapshot',
          } as any,
        }).catch(() => {});

        results.push({ id: cart.id, status: 'invalid_snapshot' });
        continue;
      }

      const renderItems = snapshotItems.slice(0, 4).map((i: any) => ({
        name: i.name || 'Item',
        craft: i.craft || null,
        region: i.region || null,
        quantity: i.quantity || 1,
        price: i.price || 0,
      }));

      const recoverUrl = `${base}/checkout?recover=${cart.id}`;
      const optOutUrl  = `${base}/recovery/opt-out?cart=${cart.id}`;
      const totalRupees = Math.round(cart.subtotal / 100);
      const phone = (cart as any).phone || null;

      // ── STAGE 4 — telecaller handoff (internal only) ──────────────────
      if (stage === 4) {
        if (!handoffEnabled) {
          await prisma.abandonedCart.update({
            where: { id: cart.id },
            data: { recoveryStage: 4, nextActionAt: null, lastRemindedAt: now } as any,
          });
          results.push({ id: cart.id, stage: 4, status: 'handoff-disabled' });
          continue;
        }

        const teamEmail = process.env.TELECALLER_TEAM_EMAIL || process.env.EMAIL_FROM || 'hello@neejee.com';
        const teamPhone = process.env.TELECALLER_TEAM_PHONE || '';
        const craftRegions = Array.from(
          new Set(
            snapshotItems
              .map((i: any) => [i.craft, i.region].filter(Boolean).join(' · '))
              .filter((s: string) => s.length > 0)
          )
        ) as string[];

        const tpl = telecallerHandoffEmail({
          cartId: cart.id,
          customerName: (cart as any).customerName,
          customerEmail: cart.email,
          customerPhone: phone,
          itemCount: cart.itemCount,
          subtotalPaise: cart.subtotal,
          craftRegions,
          adminUrl: `${base}/admin/telecaller`,
        });

        if (stageMatrix.email !== false) {
          await sendEmail({ to: teamEmail, subject: tpl.subject, html: tpl.html });
        }

        if (stageMatrix.sms && teamPhone) {
          await dispatchSms({
            event: 'TELECALLER_HANDOFF',
            recipient: teamPhone,
            variables: {
              customerName: (cart as any).customerName || cart.email,
              customerPhone: phone || 'unknown',
              trunkRupees: String(totalRupees),
              adminLink: `${base}/admin/telecaller`,
            },
            cartId: cart.id,
          });
        }

        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: {
            recoveryStage: 4,
            nextActionAt: null,
            remindersSent: { increment: 1 },
            lastRemindedAt: now,
            telecallerStatus: null,
          } as any,
        });

        results.push({ id: cart.id, stage: 4, status: 'handed-off' });
        continue;
      }

      // ── STAGES 1, 2, 3 — customer-facing ─────────────────────────────
      let discountCode: string | undefined;
      let discountPercent: number | undefined;
      let validHours: number | undefined;

      if (stage === 2) {
        const { code, percent } = await ensureStageCoupon(
          {
            id: cart.id,
            userId: cart.userId,
            email: cart.email,
            discountCode: (cart as any).discountCode || null,
            discountPercent: (cart as any).discountPercent || null,
          },
          2,
          {
            percent2: percents.stage2,
            percent3: percents.stage3,
            validHours2: cadence.stage3 - cadence.stage2,
            validHours3: 48,
          },
        );
        discountCode = code;
        discountPercent = percent;
        validHours = cadence.stage3 - cadence.stage2;
      } else if (stage === 3) {
        const { code, percent } = await ensureStageCoupon(
          {
            id: cart.id,
            userId: cart.userId,
            email: cart.email,
            discountCode: null,
            discountPercent: null,
          },
          3,
          {
            percent2: percents.stage2,
            percent3: percents.stage3,
            validHours2: 48,
            validHours3: cadence.stage4 - cadence.stage3,
          },
        );
        discountCode = code;
        discountPercent = percent;
        validHours = cadence.stage4 - cadence.stage3;
      }

      let aiCopy: any = undefined;
      if (aiEnabled) {
        try {
          aiCopy = await generateRecoveryCopy({
            customerName: (cart as any).customerName,
            items: renderItems,
            stage,
            discountPercent,
            discountCode,
            totalRupees,
          });
        } catch (e: any) {
          console.warn('[cron] ai copy failed:', e.message);
        }
      }

      if (stageMatrix.email !== false) {
        let tpl: { subject: string; html: string };

        if (stage === 1) {
          tpl = recoveryT1hEmail({
            customerName: (cart as any).customerName,
            items: renderItems,
            subtotalPaise: cart.subtotal,
            recoverUrl,
            optOutUrl,
            aiCopy,
          });
        } else if (stage === 2) {
          tpl = recoveryT24hEmail({
            customerName: (cart as any).customerName,
            items: renderItems,
            subtotalPaise: cart.subtotal,
            recoverUrl,
            optOutUrl,
            aiCopy,
            discountCode: discountCode!,
            discountPercent: discountPercent!,
            validHours: validHours!,
          });
        } else {
          tpl = recoveryT72hEmail({
            customerName: (cart as any).customerName,
            items: renderItems,
            subtotalPaise: cart.subtotal,
            recoverUrl,
            optOutUrl,
            aiCopy,
            discountCode: discountCode!,
            discountPercent: discountPercent!,
            validHours: validHours!,
          });
        }

        await sendEmail({ to: cart.email, subject: tpl.subject, html: tpl.html });
      }

      if (stageMatrix.whatsapp && phone && stage >= 2) {
        const event = stage === 2 ? 'CART_T24H' : 'CART_T72H';
        const craftRegion = renderItems[0]?.craft || renderItems[0]?.name || 'your trunk';

        await dispatchWhatsApp({
          event: event as any,
          recipient: phone,
          variables: {
            firstName: firstName((cart as any).customerName),
            craftRegion: craftRegion + (renderItems[0]?.region ? ` from ${renderItems[0].region}` : ''),
            discountPct: String(discountPercent || ''),
            code: discountCode || '',
            cartId: cart.id,
          },
          cartId: cart.id,
        });
      }

      if (stageMatrix.sms && phone && stage >= 2) {
        const event = stage === 1 ? 'CART_T1H' : stage === 2 ? 'CART_T24H' : 'CART_T72H';
        const shortLink = `${base}/r/${cart.id.slice(0, 8)}`;

        await dispatchSms({
          event: event as any,
          recipient: phone,
          variables: {
            firstName: firstName((cart as any).customerName),
            discountPct: String(discountPercent || ''),
            code: discountCode || '',
            recoveryLink: shortLink,
          },
          cartId: cart.id,
        });
      }

      const nextHours =
        stage === 1 ? cadence.stage2 - cadence.stage1
        : stage === 2 ? cadence.stage3 - cadence.stage2
        : cadence.stage4 - cadence.stage3;

      const nextActionAt = new Date(now.getTime() + nextHours * HOURS);

      await prisma.abandonedCart.update({
        where: { id: cart.id },
        data: {
          recoveryStage: stage,
          nextActionAt,
          remindersSent: { increment: 1 },
          lastRemindedAt: now,
          aiCopyJson: aiCopy ? aiCopy : undefined,
        } as any,
      });

      results.push({ id: cart.id, stage, status: 'sent', ai: aiCopy?.generatedBy });
    } catch (e: any) {
      console.warn('[cron] cart', cart.id, 'failed:', e?.message);
      results.push({ id: cart.id, error: e.message });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    elapsedMs: Date.now() - startedAt,
    results,
  });
}
