// GET (list) and POST (create) vendors.
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN'];

async function gate(write = false) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  const allowed = write ? WRITE_ROLES : ALLOWED_ROLES;
  if (!allowed.includes(session.role)) return { error: 'Forbidden', status: 403 };
  return { session };
}

export async function GET(request: Request) {
  const g = await gate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const q = url.searchParams.get('q')?.trim() || '';

  const where: any = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { legalName:    { contains: q, mode: 'insensitive' } },
      { displayName:  { contains: q, mode: 'insensitive' } },
      { contactEmail: { contains: q, mode: 'insensitive' } },
      { gstin:        { contains: q, mode: 'insensitive' } },
    ];
  }
  const vendors = await prisma.vendor.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true, legalName: true, displayName: true, contactEmail: true,
      contactPhone: true, gstin: true, city: true, state: true, status: true,
      paymentTermsDays: true, createdAt: true,
      _count: { select: { purchaseOrders: true } },
    },
  });
  return NextResponse.json({ vendors });
}

export async function POST(request: Request) {
  const g = await gate(true);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: any = {};
  try { body = await request.json(); } catch {}
  if (!body?.legalName || !body?.contactEmail) {
    return NextResponse.json({ error: 'legalName and contactEmail are required' }, { status: 400 });
  }
  const email = String(body.contactEmail).trim().toLowerCase();
  const existing = await prisma.vendor.findUnique({ where: { contactEmail: email } });
  if (existing) {
    return NextResponse.json({ error: 'A vendor with this email already exists' }, { status: 409 });
  }
  const vendor = await prisma.vendor.create({
    data: {
      legalName: body.legalName,
      displayName: body.displayName || null,
      contactPerson: body.contactPerson || null,
      contactEmail: email,
      contactPhone: body.contactPhone || null,
      gstin: body.gstin || null,
      pan: body.pan || null,
      msmeNumber: body.msmeNumber || null,
      addressLine1: body.addressLine1 || null,
      addressLine2: body.addressLine2 || null,
      city: body.city || null,
      state: body.state || null,
      pincode: body.pincode || null,
      country: body.country || 'India',
      bankAccountName: body.bankAccountName || null,
      bankAccountNumber: body.bankAccountNumber || null,
      bankIfsc: body.bankIfsc || null,
      bankName: body.bankName || null,
      paymentTermsDays: Number(body.paymentTermsDays ?? 30),
      defaultLeadTimeDays: Number(body.defaultLeadTimeDays ?? 14),
      status: body.status || 'PENDING',
      notes: body.notes || null,
    },
  });
  return NextResponse.json({ vendor }, { status: 201 });
}
