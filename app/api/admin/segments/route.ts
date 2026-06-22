// Admin customer segments — auto-computed buckets for marketing.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'];

const NOW = () => Date.now();
const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !ADMIN_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const segment = url.searchParams.get('segment') || 'all';
    const exportCsv = url.searchParams.get('format') === 'csv';

    // Load all customers (bounded by role)
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      select: {
        id: true, name: true, email: true, phone: true,
        createdAt: true,
        marketingConsent: true, emailOptIn: true, whatsappOptIn: true, smsOptIn: true,
        orders: {
          where: { paymentStatus: 'PAID' },
          select: { total: true, createdAt: true },
        },
        wishlist: { select: { id: true } },
      },
      take: 5000,
    });

    const now = NOW();

    // Categorize
    const buckets = {
      ALL: [] as any[],
      NEW: [] as any[],            // created < 30 days, 0 orders
      ACTIVE: [] as any[],         // last paid order <= 60 days
      VIP: [] as any[],            // 3+ paid orders OR lifetime > 50k
      AT_RISK: [] as any[],        // last paid order 60-120 days ago
      LAPSED: [] as any[],         // last paid order > 120 days ago
      WISHLIST_ONLY: [] as any[],  // wishlist > 0, paid = 0
    };

    for (const c of customers) {
      const orderCount = c.orders.length;
      const lifetime = c.orders.reduce((s, o) => s + o.total, 0);
      const lastOrder = orderCount > 0
        ? Math.max(...c.orders.map(o => new Date(o.createdAt).getTime()))
        : 0;
      const daysSinceLast = lastOrder > 0 ? Math.floor((now - lastOrder) / DAYS(1)) : null;
      const daysSinceSignup = Math.floor((now - new Date(c.createdAt).getTime()) / DAYS(1));

      const row = {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        signedUpAt: c.createdAt,
        daysSinceSignup,
        orderCount,
        lifetime,
        lastOrderAt: lastOrder > 0 ? new Date(lastOrder) : null,
        daysSinceLast,
        wishlistCount: c.wishlist.length,
        emailOptIn: c.emailOptIn,
        marketingConsent: c.marketingConsent,
        whatsappOptIn: c.whatsappOptIn,
        smsOptIn: c.smsOptIn,
      };

      buckets.ALL.push(row);

      if (orderCount === 0 && daysSinceSignup < 30) buckets.NEW.push(row);
      if (orderCount >= 3 || lifetime > 5000000) buckets.VIP.push(row);
      if (orderCount > 0 && daysSinceLast !== null && daysSinceLast <= 60) buckets.ACTIVE.push(row);
      if (orderCount > 0 && daysSinceLast !== null && daysSinceLast > 60 && daysSinceLast <= 120) buckets.AT_RISK.push(row);
      if (orderCount > 0 && daysSinceLast !== null && daysSinceLast > 120) buckets.LAPSED.push(row);
      if (orderCount === 0 && c.wishlist.length > 0) buckets.WISHLIST_ONLY.push(row);
    }

    if (exportCsv) {
      const key = segment.toUpperCase() as keyof typeof buckets;
      const rows = buckets[key] || buckets.ALL;
      const header = 'Name,Email,Phone,Orders,Lifetime (INR),Last Order,Email Opt-in,Marketing Consent\n';
      const csv = header + rows.map(r =>
        [
          (r.name || '').replace(/,/g, ' '),
          r.email,
          r.phone || '',
          r.orderCount,
          (r.lifetime / 100).toFixed(0),
          r.lastOrderAt ? new Date(r.lastOrderAt).toISOString().slice(0, 10) : '',
          r.emailOptIn ? 'yes' : 'no',
          r.marketingConsent ? 'yes' : 'no',
        ].join(',')
      ).join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="neejee-segment-${segment}-${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      counts: {
        ALL: buckets.ALL.length,
        NEW: buckets.NEW.length,
        ACTIVE: buckets.ACTIVE.length,
        VIP: buckets.VIP.length,
        AT_RISK: buckets.AT_RISK.length,
        LAPSED: buckets.LAPSED.length,
        WISHLIST_ONLY: buckets.WISHLIST_ONLY.length,
      },
      buckets,
    });
  } catch (e: any) {
    console.error('[segments] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
