import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { synchronizeEffectiveCommercialTerms } from '@/lib/seller-commercial-lifecycle';
import { sendSellerTransactionalEmail } from '@/lib/seller-onboarding/transactional-email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function authorized(req: Request) {
  const expected = process.env.CRON_SECRET;
  return !!expected && (req.headers.get('authorization') || '') === `Bearer ${expected}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function run() {
  const now = new Date();
  const syncResults = await synchronizeEffectiveCommercialTerms().catch(() => []);

  await prisma.$executeRaw`
    UPDATE "Seller" s
    SET "kycStatus" = 'SUSPENDED', "updatedAt" = NOW()
    WHERE s."kycStatus" = 'APPROVED'
      AND EXISTS (
        SELECT 1 FROM "SellerCommercialInstrument" i
        WHERE i."sellerRef" = s."id"
          AND i."instrumentType" <> 'TERMINATION'
          AND i."status" IN ('ACTIVE','EXPIRED','COMPANY_SIGNED')
      )
      AND NOT EXISTS (
        SELECT 1 FROM "SellerCommercialInstrument" i
        WHERE i."sellerRef" = s."id"
          AND i."instrumentType" <> 'TERMINATION'
          AND i."status" = 'ACTIVE'
          AND i."effectiveFrom" <= ${now}
          AND (i."effectiveTo" IS NULL OR i."effectiveTo" >= ${now})
      )
  `;

  await prisma.$executeRaw`
    UPDATE "Seller" s
    SET "kycStatus" = 'APPROVED', "updatedAt" = NOW()
    WHERE s."kycStatus" = 'SUSPENDED'
      AND EXISTS (
        SELECT 1 FROM "SellerCommercialInstrument" i
        WHERE i."sellerRef" = s."id"
          AND i."instrumentType" <> 'TERMINATION'
          AND i."status" = 'ACTIVE'
          AND i."effectiveFrom" <= ${now}
          AND (i."effectiveTo" IS NULL OR i."effectiveTo" >= ${now})
      )
      AND NOT EXISTS (
        SELECT 1 FROM "SellerCommercialInstrument" t
        WHERE t."sellerRef" = s."id"
          AND t."instrumentType" = 'TERMINATION'
          AND t."status" = 'TERMINATED'
          AND t."effectiveFrom" <= ${now}
      )
  `;

  const due = await prisma.$queryRaw<any[]>`
    SELECT
      i."id", i."sellerRef", i."instrumentNumber", i."title", i."effectiveTo",
      s."businessName", s."contactName", s."email"
    FROM "SellerCommercialInstrument" i
    JOIN "Seller" s ON s."id" = i."sellerRef"
    WHERE i."instrumentType" <> 'TERMINATION'
      AND i."status" = 'ACTIVE'
      AND i."effectiveTo" IS NOT NULL
      AND i."effectiveTo" >= ${now}
      AND i."effectiveTo" <= ${new Date(now.getTime() + 31 * 86400000)}
  `;

  const reminders: any[] = [];
  for (const item of due) {
    const end = new Date(item.effectiveTo);
    const days = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    const threshold = days <= 1 ? 1 : days <= 7 ? 7 : days <= 30 ? 30 : null;
    if (!threshold) continue;

    const eventKey = `commercial-expiry-reminder:${item.id}:${threshold}`;
    const exists = await prisma.$queryRaw<any[]>`
      SELECT "id" FROM "SellerRelationshipEvent" WHERE "eventKey" = ${eventKey} LIMIT 1
    `;
    if (exists.length) continue;

    try {
      await sendSellerTransactionalEmail({
        to: item.email,
        subject: `NEEJEE seller agreement validity — ${threshold} day reminder`,
        html: `
          <div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;color:#1c1917;">
            <div style="background:#1A1613;color:#F4EFE6;padding:30px;text-align:center;"><div style="font-size:28px;letter-spacing:.18em;">NEEJEE</div></div>
            <div style="padding:34px;">
              <p>Dear ${escapeHtml(String(item.contactName || 'Seller').split(/\s+/)[0])},</p>
              <p style="line-height:1.7;">This is a validity reminder for the current NEEJEE seller commercial term.</p>
              <div style="background:#F7F2E9;padding:18px;line-height:1.7;margin:20px 0;">
                ${escapeHtml(item.title)}<br/>
                Reference: ${escapeHtml(item.instrumentNumber)}<br/>
                Current term ends: ${escapeHtml(end.toLocaleDateString('en-IN'))}<br/>
                Seller: ${escapeHtml(item.businessName)}
              </div>
              <p style="line-height:1.7;">NEEJEE may issue a renewal agreement, addendum or other relationship instrument as applicable. Existing signed records remain preserved in the relationship history.</p>
            </div>
          </div>`,
      });

      await prisma.$executeRaw`
        INSERT INTO "SellerRelationshipEvent" (
          "id", "sellerId", "sellerRef", "instrumentId", "eventKey", "eventType", "title", "details", "occurredAt", "createdAt"
        ) VALUES (
          ${randomUUID()}, ${item.sellerRef}, ${item.sellerRef}, ${item.id}, ${eventKey},
          'VALIDITY_REMINDER_SENT', ${`${threshold}-day commercial validity reminder sent`},
          CAST(${JSON.stringify({ thresholdDays: threshold, validTo: end.toISOString(), recipient: item.email })} AS jsonb), NOW(), NOW()
        )
        ON CONFLICT ("eventKey") DO NOTHING
      `;
      reminders.push({ instrumentId: item.id, threshold, sent: true });
    } catch (error: any) {
      reminders.push({ instrumentId: item.id, threshold, sent: false, error: String(error?.message || 'email_failed') });
    }
  }

  return NextResponse.json({ ok: true, synced: syncResults.length, reminders });
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return run();
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return run();
}
