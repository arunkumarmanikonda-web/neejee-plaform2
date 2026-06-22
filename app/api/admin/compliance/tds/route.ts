// /api/admin/compliance/tds
// GET  - list TDS certificates with optional FY/quarter/vendor/status filters
// POST - generate all certificates for a given (financialYear, quarter)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  generateAllCertificatesForQuarter,
  parseFyQuarter,
  type Quarter,
} from '@/lib/compliance/tds';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FINANCE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN'];

async function gate(write = false) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const allowed = write ? WRITE_ROLES : FINANCE_ROLES;
  if (!allowed.includes(session.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(req: NextRequest) {
  const g = await gate(false);
  if (g.error) return g.error;
  const url = new URL(req.url);
  const fy = url.searchParams.get('fy') || undefined;
  const q = url.searchParams.get('q');
  const vendorId = url.searchParams.get('vendorId') || undefined;
  const status = url.searchParams.get('status') || undefined;

  const where: any = {};
  if (fy) where.financialYear = fy;
  if (q) where.quarter = Number(q);
  if (vendorId) where.vendorId = vendorId;
  // Note: schema has no status field on TdsCertificate — status is derived
  // from issuedAt (DRAFT if null, ISSUED otherwise). The 'status' query param
  // is honoured by filtering issuedAt accordingly.
  if (status === 'DRAFT') where.issuedAt = null;
  else if (status === 'ISSUED') where.issuedAt = { not: null };

  const rows = await prisma.tdsCertificate.findMany({
    where,
    orderBy: [{ financialYear: 'desc' }, { quarter: 'desc' }, { createdAt: 'desc' }],
    include: {
      vendor: { select: { id: true, legalName: true, pan: true, gstin: true } },
    },
    take: 500,
  });

  // Quick FY/quarter summary for the toolbar.
  const totals = rows.reduce(
    (acc, r) => {
      acc.tds += r.tdsDeductedPaise;
      acc.gross += r.grossPaymentsPaise;
      acc.count += 1;
      return acc;
    },
    { tds: 0, gross: 0, count: 0 }
  );

  return NextResponse.json({ rows, totals });
}

export async function POST(req: NextRequest) {
  const g = await gate(true);
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const fy = String(body.financialYear || '').trim();
    const quarter = Number(body.quarter);
    if (!/^\d{4}-\d{2}$/.test(fy) || ![1, 2, 3, 4].includes(quarter)) {
      return NextResponse.json(
        { error: 'financialYear (YYYY-YY) and quarter (1..4) are required' },
        { status: 400 }
      );
    }
    // Validate quarter exists in calendar.
    parseFyQuarter(fy, quarter as Quarter);

    const result = await generateAllCertificatesForQuarter(
      fy,
      quarter as Quarter,
      g.session!.id
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to generate' }, { status: 500 });
  }
}
