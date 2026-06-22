// One-shot seeder: copy the hard-coded BADGE_CATALOG into the DB.
// Safe to run multiple times — uses upsert by key.
import { NextResponse } from 'next/server';
import { getSession, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BADGE_CATALOG } from '@/lib/badges';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN'])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let created = 0;
  let skipped = 0;
  for (let i = 0; i < BADGE_CATALOG.length; i++) {
    const b = BADGE_CATALOG[i];
    const existing = await prisma.badge.findUnique({ where: { key: b.key } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.badge.create({
      data: {
        key: b.key,
        label: b.label,
        description: b.description,
        group: b.group,
        sortOrder: i,
        active: true,
      },
    });
    created++;
  }
  return NextResponse.json({ ok: true, created, skipped, total: BADGE_CATALOG.length });
}
