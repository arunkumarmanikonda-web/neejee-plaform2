// GET / PUT /api/admin/legal-entity
// Singleton settings for the company that operates the NEEJEE brand.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaErrorToHttp } from '@/lib/prisma-errors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];

async function requireAdmin() {
  const session = await getSession();
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    return null;
  }
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const entity = await prisma.legalEntity.findUnique({ where: { key: 'default' } });
    return NextResponse.json({ entity });
  } catch (e: any) {
    console.error('[legal-entity GET]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}

const STRING_FIELDS = [
  'legalName', 'brandName', 'gstin', 'pan', 'cinNumber', 'msmeNumber',
  'addressLine1', 'addressLine2', 'city', 'state', 'pincode', 'country',
  'bankAccountName', 'bankAccountNumber', 'bankIfsc', 'bankName', 'bankBranch',
  // PRIVATE — finance / signatory (invoices, POs)
  'contactEmail', 'contactPhone', 'authorisedSignatory', 'signatoryTitle',
  // v23.40.25.2 — PUBLIC website contact (footer, /help/contact)
  'publicEmail', 'publicPhone', 'publicWhatsapp', 'publicAddressLine', 'socialInstagram',
  'logoUrl', 'signatureUrl',
];

export async function PUT(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Only SUPER_ADMIN / ADMIN can edit (FINANCE can read but not write)
  if (session.role === 'FINANCE') {
    return NextResponse.json({ error: 'Read-only role' }, { status: 403 });
  }
  let body: any = {};
  try { body = await request.json(); } catch {}
  if (!body?.legalName || typeof body.legalName !== 'string') {
    return NextResponse.json({ error: 'legalName is required' }, { status: 400 });
  }
  const data: Record<string, any> = {};
  for (const k of STRING_FIELDS) {
    if (k in body) {
      const v = body[k];
      data[k] = v === '' ? null : v;
    }
  }
  if (typeof body.gstEnabled === 'boolean') data.gstEnabled = body.gstEnabled;
  if (typeof body.defaultGstRate === 'number') data.defaultGstRate = body.defaultGstRate;
  // Ensure required field is non-null on upsert
  if (!data.legalName) data.legalName = body.legalName;

  try {
    const entity = await prisma.legalEntity.upsert({
      where: { key: 'default' },
      update: data,
      create: { key: 'default', legalName: body.legalName, ...data },
    });
    // v23.40.16 — invalidate the issuer cache so the very next invoice render
    // picks up the new GSTIN / address / bank / signatory immediately.
    try {
      const { invalidateIssuerCache } = await import('@/lib/finance/legal-entity');
      invalidateIssuerCache();
    } catch { /* helper unavailable during build; safe to ignore */ }
    return NextResponse.json({ entity });
  } catch (e: any) {
    console.error('[legal-entity PUT]', e);
    const { status, message, code } = prismaErrorToHttp(e);
    return NextResponse.json({ error: message, code }, { status });
  }
}
