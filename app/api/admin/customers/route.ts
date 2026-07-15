import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CUSTOMER_VIEW_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'TELECALLER',
  'MARKETING_OPERATOR',
  'MARKETING_MANAGER',
] as const;

async function getCustomersPayload() {
  const customers = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    take: 200,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      createdAt: true,
      orders: {
        select: {
          id: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
        },
      },
    },
  });

  const mapped = customers.map((c: any) => {
    const paidOrders = c.orders.filter((o: any) => o.paymentStatus === 'PAID');
    const ltv = paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);

    const lastOrder =
      c.orders.length > 0
        ? c.orders.reduce(
            (max: any, o: any) => (o.createdAt > max ? o.createdAt : max),
            c.orders[0].createdAt,
          )
        : null;

    let tier = 'NEW';
    if (ltv >= 5000000) tier = 'PLATINUM';
    else if (ltv >= 2000000) tier = 'GOLD';
    else if (ltv >= 500000) tier = 'SILVER';
    else if (c.orders.length > 0) tier = 'BRONZE';

    return {
      id: c.id,
      name: c.name || c.email.split('@')[0],
      email: c.email,
      phone: c.phone,
      orderCount: c.orders.length,
      ltv,
      lastOrder,
      tier,
      joined: c.createdAt,
    };
  });

  const totalCustomers = await prisma.user.count({ where: { role: 'CUSTOMER' } });
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const newThisMonth = await prisma.user.count({
    where: { role: 'CUSTOMER', createdAt: { gte: thirtyDaysAgo } },
  });

  const repeatBuyers = mapped.filter((c: any) => c.orderCount > 1).length;
  const repeatRate = totalCustomers > 0 ? Math.round((repeatBuyers / totalCustomers) * 100) : 0;
  const totalLtv = mapped.reduce((s: number, c: any) => s + c.ltv, 0);
  const avgLtv = mapped.length > 0 ? Math.round(totalLtv / mapped.length) : 0;

  return {
    customers: mapped,
    stats: { totalCustomers, newThisMonth, repeatRate, avgLtv },
  };
}

export async function GET() {
  const user = await getSession();
  if (!requireRole(user, [...CUSTOMER_VIEW_ROLES])) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json(await getCustomersPayload());
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to load customers', customers: [], stats: {} },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const actor = await getSession();

  if (!requireRole(actor, ['SUPER_ADMIN'])) {
    return NextResponse.json(
      { error: 'Only SUPER_ADMIN can delete customers' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const id = String(body?.id || '').trim();

    if (!id) {
      return NextResponse.json({ error: 'Customer id is required' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    if (!target) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (target.role !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Only CUSTOMER users can be deleted from this panel' },
        { status: 400 },
      );
    }

    if (actor?.id === target.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 },
      );
    }

    if (target._count.orders > 0) {
      return NextResponse.json(
        { error: 'Customers with orders cannot be deleted' },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      if ((tx as any).customer?.deleteMany) {
        await (tx as any).customer.deleteMany({ where: { userId: target.id } });
      }
      if ((tx as any).address?.deleteMany) {
        await (tx as any).address.deleteMany({ where: { userId: target.id } });
      }
      if ((tx as any).wishlist?.deleteMany) {
        await (tx as any).wishlist.deleteMany({ where: { userId: target.id } });
      }
      if ((tx as any).aiPreview?.deleteMany) {
        await (tx as any).aiPreview.deleteMany({ where: { userId: target.id } });
      }
      if ((tx as any).loyaltyLedger?.deleteMany) {
        await (tx as any).loyaltyLedger.deleteMany({
          where: {
            OR: [{ userId: target.id }, { awardedById: target.id }],
          },
        });
      }
      if ((tx as any).notificationLog?.deleteMany) {
        await (tx as any).notificationLog.deleteMany({ where: { userId: target.id } });
      }
      if ((tx as any).referral?.deleteMany) {
        await (tx as any).referral.deleteMany({ where: { referrerId: target.id } });
        await (tx as any).referral.updateMany({
          where: { refereeId: target.id },
          data: { refereeId: null },
        });
      }

      await tx.user.delete({
        where: { id: target.id },
      });
    });

    return NextResponse.json({
      ok: true,
      deletedId: target.id,
      deletedEmail: target.email,
    });
  } catch (e: any) {
    if (e?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Customer has linked records and cannot be deleted yet' },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: e?.message || 'Failed to delete customer' },
      { status: 500 },
    );
  }
}