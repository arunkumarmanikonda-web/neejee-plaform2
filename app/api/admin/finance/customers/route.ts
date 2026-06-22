// v23.40.11 — Customers list + create
// GET  /api/admin/finance/customers          — list (with filters)
// POST /api/admin/finance/customers          — create
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { requireFinancePerm } from '@/lib/finance/roles';
import { prismaErrorToHttp } from '@/lib/prisma-errors';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.read');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const url = new URL(req.url);
  const type    = url.searchParams.get('type');
  const channel = url.searchParams.get('channel');
  const status  = url.searchParams.get('status') || 'ACTIVE';
  const limit   = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);

  const where: any = {};
  if (status !== 'ALL') where.status = status;
  if (type)    where.customerType = type;
  if (channel) where.channel = channel;

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { displayName: 'asc' },
    take: limit,
  });

  return NextResponse.json({ customers });
}

export async function POST(req: Request) {
  const session = await getSession();
  const gate = requireFinancePerm(session, 'finance.write');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  try {
    const body = await req.json();
    const {
      displayName, legalName, primaryEmail, primaryPhone,
      gstin, pan, placeOfSupply, billingAddress, shippingAddress,
      customerType, channel, creditLimitPaise, creditDays, notes,
    } = body;

    if (!displayName?.trim()) {
      return NextResponse.json({ error: 'displayName required' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        id: 'cust_' + randomBytes(10).toString('hex'),
        displayName: String(displayName).trim(),
        legalName: legalName?.trim() || null,
        primaryEmail: primaryEmail?.trim().toLowerCase() || null,
        primaryPhone: primaryPhone?.trim() || null,
        gstin: gstin?.trim() || null,
        pan: pan?.trim() || null,
        placeOfSupply: placeOfSupply?.trim() || null,
        billingAddress: billingAddress?.trim() || null,
        shippingAddress: shippingAddress?.trim() || null,
        customerType: customerType || 'INDIVIDUAL',
        channel: channel || 'WEBSITE',
        creditLimitPaise: parseInt(creditLimitPaise) || 0,
        creditDays: parseInt(creditDays) || 0,
        notes: notes?.trim() || null,
        source: 'MANUAL',
        createdByUserId: session!.id,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (err: any) {
    const m = prismaErrorToHttp(err);
    return NextResponse.json({ error: m.message }, { status: m.status });
  }
}
