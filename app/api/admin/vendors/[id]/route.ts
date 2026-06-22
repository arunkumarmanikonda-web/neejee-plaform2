// GET / PATCH / DELETE single vendor
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WRITE_ROLES = ['ADMIN', 'SUPER_ADMIN'];

async function gate(write = false) {
  const session = await getSession();
  if (!session) return { error: 'Unauthorized', status: 401 };
  if (write && !WRITE_ROLES.includes(session.role)) {
    return { error: 'Forbidden', status: 403 };
  }
  if (!['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(session.role)) {
    return { error: 'Forbidden', status: 403 };
  }
  return { session };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await gate();
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { purchaseOrders: true, purchaseCosts: true } },
      user: { select: { id: true, email: true, name: true, image: true } },
    },
  });
  if (!vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ vendor });
}

const STRING_FIELDS = [
  'legalName','displayName','contactPerson','contactEmail','contactPhone',
  'gstin','pan','msmeNumber',
  'addressLine1','addressLine2','city','state','pincode','country',
  'bankAccountName','bankAccountNumber','bankIfsc','bankName',
  'notes','status',
];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const g = await gate(true);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  let body: any = {};
  try { body = await request.json(); } catch {}
  const data: Record<string, any> = {};
  for (const k of STRING_FIELDS) {
    if (k in body) data[k] = body[k] === '' ? null : body[k];
  }
  if ('paymentTermsDays' in body) data.paymentTermsDays = Number(body.paymentTermsDays);
  if ('defaultLeadTimeDays' in body) data.defaultLeadTimeDays = Number(body.defaultLeadTimeDays);
  if (data.contactEmail) data.contactEmail = String(data.contactEmail).toLowerCase();
  try {
    const vendor = await prisma.vendor.update({ where: { id: params.id }, data });
    return NextResponse.json({ vendor });
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await gate(true);
  if ('error' in g) return NextResponse.json({ error: g.error }, { status: g.status });
  // Soft-delete by archiving instead of hard-delete (Vendor referenced by POs and costs)
  try {
    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: { status: 'ARCHIVED' },
    });
    return NextResponse.json({ vendor });
  } catch (e: any) {
    if (e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    throw e;
  }
}
