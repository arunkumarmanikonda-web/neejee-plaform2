import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VIEW_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'TELECALLER',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
] as const;

const FULL_EDIT_ROLES = ['SUPER_ADMIN'] as const;

const CRM_EDIT_ROLES = [
  'TELECALLER',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
] as const;

function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  return email || null;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseOptionalDate(value: unknown, fieldLabel: string) {
  if (value === undefined) {
    return { provided: false as const, value: undefined };
  }

  if (value === null || value === '') {
    return { provided: true as const, value: null };
  }

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return { provided: true as const, error: `${fieldLabel} must be a valid date` };
  }

  return { provided: true as const, value: date };
}

async function getCustomerDetail(id: string) {
  const customer = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      marketingConsent: true,
      smsOptIn: true,
      whatsappOptIn: true,
      emailOptIn: true,
      phoneVerified: true,
      phoneVerifiedAt: true,
      primaryAuthMethod: true,
      dateOfBirth: true,
      anniversaryAt: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          orders: true,
          addresses: true,
          wishlist: true,
        },
      },
    },
  });

  if (!customer || customer.role !== 'CUSTOMER') {
    return null;
  }

  const paidOrders = customer.orders.filter((o: any) => o.paymentStatus === 'PAID');
  const ltv = paidOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  const lastOrder = customer.orders.length > 0 ? customer.orders[0].createdAt : null;

  let tier = 'NEW';
  if (ltv >= 5000000) tier = 'PLATINUM';
  else if (ltv >= 2000000) tier = 'GOLD';
  else if (ltv >= 500000) tier = 'SILVER';
  else if (customer._count.orders > 0) tier = 'BRONZE';

  return {
    ...customer,
    stats: {
      orderCount: customer._count.orders,
      addressCount: customer._count.addresses,
      wishlistCount: customer._count.wishlist,
      paidOrderCount: paidOrders.length,
      ltv,
      tier,
      lastOrder,
    },
  };
}

function getPermissions(actor: any) {
  return {
    canView: requireRole(actor, [...VIEW_ROLES] as any),
    canFullEdit: requireRole(actor, [...FULL_EDIT_ROLES] as any),
    canCrmEdit: requireRole(actor, [...CRM_EDIT_ROLES] as any),
    canDelete: requireRole(actor, ['SUPER_ADMIN'] as any),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getSession();
  const permissions = getPermissions(actor);

  if (!permissions.canView) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const id = String(params?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Customer id is required' }, { status: 400 });
    }

    const customer = await getCustomerDetail(id);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({
      customer,
      permissions,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load customer' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const actor = await getSession();
  const permissions = getPermissions(actor);

  if (!permissions.canFullEdit && !permissions.canCrmEdit) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const id = String(params?.id || '').trim();
    if (!id) {
      return NextResponse.json({ error: 'Customer id is required' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    if (!target || target.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const allowed: Record<string, any> = {};

    if (typeof body.name === 'string') {
      allowed.name = body.name.trim() || null;
    }

    if (typeof body.phone === 'string') {
      const phone = body.phone.trim();

      if (phone) {
        const clash = await prisma.user.findFirst({
          where: {
            phone,
            NOT: { id: target.id },
          },
          select: { id: true },
        });

        if (clash) {
          return NextResponse.json(
            { error: 'Phone already in use' },
            { status: 409 },
          );
        }

        allowed.phone = phone;
      } else {
        allowed.phone = null;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'dateOfBirth')) {
      const parsed = parseOptionalDate(body.dateOfBirth, 'Date of birth');
      if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      if (parsed.provided) {
        allowed.dateOfBirth = parsed.value;
      }
    }

    if (Object.prototype.hasOwnProperty.call(body, 'anniversaryAt')) {
      const parsed = parseOptionalDate(body.anniversaryAt, 'Anniversary');
      if ('error' in parsed) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      if (parsed.provided) {
        allowed.anniversaryAt = parsed.value;
      }
    }

    if (typeof body.marketingConsent === 'boolean') {
      allowed.marketingConsent = body.marketingConsent;
    }

    if (typeof body.smsOptIn === 'boolean') {
      allowed.smsOptIn = body.smsOptIn;
    }

    if (typeof body.whatsappOptIn === 'boolean') {
      allowed.whatsappOptIn = body.whatsappOptIn;
    }

    if (typeof body.emailOptIn === 'boolean') {
      allowed.emailOptIn = body.emailOptIn;
    }

    if (Object.prototype.hasOwnProperty.call(body, 'email')) {
      if (!permissions.canFullEdit) {
        return NextResponse.json(
          { error: 'Only SUPER_ADMIN can update email' },
          { status: 403 },
        );
      }

      const email = normalizeEmail(body.email);

      if (!email) {
        return NextResponse.json(
          { error: 'Email is required' },
          { status: 400 },
        );
      }

      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: 'Please enter a valid email address' },
          { status: 400 },
        );
      }

      const clash = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: target.id },
        },
        select: { id: true },
      });

      if (clash) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 409 },
        );
      }

      allowed.email = email;
    }

    if (!permissions.canFullEdit) {
      delete allowed.email;
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: target.id },
      data: allowed,
    });

    const customer = await getCustomerDetail(target.id);

    return NextResponse.json({
      success: true,
      customer,
      permissions,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to update customer' },
      { status: 500 },
    );
  }
}