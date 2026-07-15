// app/api/admin/telecaller/route.ts
// Telecaller queue + CSV export.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'TELECALLER',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
] as const;

export async function GET(req: Request) {
  const user = await getSession();
  if (!requireRole(user, ALLOWED_ROLES as any)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get('format');
  const outcome = url.searchParams.get('outcome');

  const where: any = {
    recoveryStage: 4,
    recoveredOrderId: null,
    optedOut: false,
  };

  if (outcome) {
    where.telecallerStatus = outcome === 'pending' ? null : outcome;
  }

  const carts = await prisma.abandonedCart.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 500,
  });

  if (format === 'csv') {
    const rows = [
      ['Customer', 'Email', 'Phone', 'Cart value', 'Items', 'Days waiting', 'Status', 'Notes'],
      ...carts.map((c: any) => [
        c.customerName || '',
        c.email,
        c.phone || '',
        (c.subtotal / 100).toFixed(0),
        String(c.itemCount),
        String(Math.floor((Date.now() - new Date(c.createdAt).getTime()) / (24 * 60 * 60 * 1000))),
        c.telecallerStatus || 'pending',
        (c.telecallerNotes || '').replace(/[\r\n"]/g, ' '),
      ]),
    ];

    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="telecaller-queue-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ carts });
}