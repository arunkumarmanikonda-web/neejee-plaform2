// v23.40.4 — Vendor autocomplete for finance forms.
// GET /api/admin/finance/vendors/search?q=<text>
// Returns up to 15 vendors matching legalName / displayName / GSTIN / email.

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
  const q = url.searchParams.get('q')?.trim() || '';
  if (q.length < 2) return NextResponse.json({ vendors: [] });

  const vendors = await prisma.vendor.findMany({
    where: {
      status: { not: 'ARCHIVED' },
      OR: [
        { displayName: { contains: q, mode: 'insensitive' } },
        { legalName:   { contains: q, mode: 'insensitive' } },
        { contactEmail:{ contains: q, mode: 'insensitive' } },
        { gstin:       { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, displayName: true, legalName: true, contactEmail: true,
      contactPhone: true, gstin: true, status: true, paymentTermsDays: true,
    },
    orderBy: { displayName: 'asc' },
    take: 15,
  });
  return NextResponse.json({ vendors });
}
