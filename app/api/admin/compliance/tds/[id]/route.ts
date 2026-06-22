// /api/admin/compliance/tds/[id]
// GET    - fetch certificate detail + printable HTML
// PATCH  - update status (ISSUED), set certificateNumber, mark sent
// DELETE - cancel certificate (only DRAFT)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { renderTdsStatementHtml } from '@/lib/compliance/tds-html';


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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate(false);
  if (g.error) return g.error;
  const url = new URL(req.url);
  const wantHtml = url.searchParams.get('html') === '1';

  const cert = await prisma.tdsCertificate.findUnique({
    where: { id: params.id },
    include: { vendor: true },
  });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (wantHtml) {
    const legal = await prisma.legalEntity
      .findFirst({ orderBy: { createdAt: 'asc' } })
      .catch(() => null);
    // Pull all payouts referenced by coveredPayoutIds so the statement
    // can render the line-item table.
    const payouts = cert.coveredPayoutIds.length
      ? await prisma.vendorPayout.findMany({
          where: { id: { in: cert.coveredPayoutIds } },
          orderBy: { paidAt: 'asc' },
        })
      : [];
    const html = renderTdsStatementHtml({
      cert,
      vendor: cert.vendor,
      legalEntity: legal,
      payouts,
    });
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({ certificate: cert });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate(true);
  if (g.error) return g.error;
  try {
    const body = await req.json();
    const cert = await prisma.tdsCertificate.findUnique({ where: { id: params.id } });
    if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const data: any = {};
    if (body.action === 'ISSUE') {
      data.issuedAt = new Date();
      data.issuedByUserId = g.session!.id;
      if (body.certificateNumber) data.certificateNumber = String(body.certificateNumber).trim();
    } else if (body.action === 'RECORD_TRACES') {
      // CA records the TRACES receipt after filing
      if (body.tracesReceiptNo) data.tracesReceiptNo = String(body.tracesReceiptNo).trim();
      if (body.tracesFilingDate) data.tracesFilingDate = new Date(body.tracesFilingDate);
    } else {
      if (body.certificateNumber !== undefined)
        data.certificateNumber = String(body.certificateNumber || '').trim() || null;
      if (body.pdfUrl !== undefined)
        data.pdfUrl = String(body.pdfUrl || '').trim() || null;
    }

    const updated = await prisma.tdsCertificate.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true, certificate: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await gate(true);
  if (g.error) return g.error;
  const cert = await prisma.tdsCertificate.findUnique({ where: { id: params.id } });
  if (!cert) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (cert.issuedAt) {
    return NextResponse.json(
      { error: 'Only un-issued (DRAFT) certificates may be deleted' },
      { status: 400 }
    );
  }
  await prisma.tdsCertificate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
