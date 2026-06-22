// v23.40.11 — Customer autocomplete search.
// GET /api/admin/finance/customers/search?q=<text>
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ customers: [] });

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { displayName:  { contains: q, mode: 'insensitive' } },
        { legalName:    { contains: q, mode: 'insensitive' } },
        { primaryEmail: { contains: q, mode: 'insensitive' } },
        { primaryPhone: { contains: q } },
        { gstin:        { contains: q, mode: 'insensitive' } },
      ],
      status: 'ACTIVE',
    },
    select: {
      id: true, displayName: true, legalName: true,
      primaryEmail: true, primaryPhone: true, gstin: true,
      customerType: true, channel: true, status: true,
    },
    take: 15,
    orderBy: { displayName: 'asc' },
  });

  return NextResponse.json({ customers });
}
