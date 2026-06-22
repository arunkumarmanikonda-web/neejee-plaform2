import { prisma } from '@/lib/prisma';
import { getSession, requireRole } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { formatINR } from '@/lib/money';
import { Mail, Check } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getData() {
  const carts = await prisma.abandonedCart.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const totals = await prisma.abandonedCart.aggregate({
    _count: { _all: true },
    _sum: { subtotal: true },
  });

  const recovered = await prisma.abandonedCart.count({
    where: { recoveredOrderId: { not: null } },
  });

  return {
    carts,
    totalCount: totals._count._all,
    totalValue: totals._sum.subtotal || 0,
    recoveredCount: recovered,
    recoveryRate: totals._count._all > 0 ? Math.round((recovered / totals._count._all) * 100) : 0,
  };
}

export default async function AdminAbandoned() {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR'])) redirect('/login');

  const { carts, totalCount, totalValue, recoveredCount, recoveryRate } = await getData();

  return (
    <div className="space-y-8 p-6">
      <div>
        <p className="label text-madder">RECOVERY</p>
        <h1 className="font-display text-4xl text-kohl">Abandoned Carts</h1>
        <p className="font-italic italic text-mitti mt-1">A gentle reminder, not a hard sell.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="ALL TIME" value={totalCount.toString()} />
        <Kpi label="POTENTIAL VALUE" value={formatINR(totalValue)} />
        <Kpi label="RECOVERED" value={recoveredCount.toString()} accent />
        <Kpi label="RECOVERY RATE" value={`${recoveryRate}%`} />
      </div>

      {/* Setup card */}
      <div className="bg-banarasi/10 border border-banarasi/30 p-5">
        <p className="font-display text-lg text-kohl">Automated reminders</p>
        <p className="font-italic italic text-mitti text-sm mt-1">
          3 gentle nudges at 2h, 24h, and 72h after abandonment. Strictly opt-in respected.
        </p>
        <div className="mt-3 text-xs space-y-1 text-mitti">
          <p>• Endpoint: <code className="bg-ivory px-2 py-0.5">/api/cron/abandoned-cart</code></p>
          <p>• Auth: secured via <code className="bg-ivory px-2 py-0.5">CRON_SECRET</code> env var</p>
          <p>• Schedule: hourly recommended (add to <code className="bg-ivory px-2 py-0.5">vercel.json</code>)</p>
        </div>
      </div>

      {/* Table */}
      <section className="bg-beige overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-kohl text-ivory">
            <tr className="text-left text-xs label">
              <th className="p-3">EMAIL</th>
              <th className="p-3 text-right">ITEMS</th>
              <th className="p-3 text-right">VALUE</th>
              <th className="p-3">ABANDONED</th>
              <th className="p-3 text-center">REMINDERS</th>
              <th className="p-3">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {carts.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center font-italic italic text-mitti">No abandoned carts yet. (That is a good sign.)</td></tr>
            ) : carts.map(c => (
              <tr key={c.id} className="border-b border-mitti/10">
                <td className="p-3 font-ui">{c.email}</td>
                <td className="p-3 text-right">{c.itemCount}</td>
                <td className="p-3 text-right">{formatINR(c.subtotal)}</td>
                <td className="p-3 text-xs text-mitti">
                  {ago(new Date(c.createdAt))}
                </td>
                <td className="p-3 text-center">
                  <span className="inline-flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span
                        key={i}
                        className={`w-2 h-2 rounded-full ${i < c.remindersSent ? 'bg-madder' : 'bg-mitti/20'}`}
                        title={i < c.remindersSent ? `Reminder ${i+1} sent` : `Reminder ${i+1} pending`}
                      />
                    ))}
                  </span>
                </td>
                <td className="p-3">
                  {c.recoveredOrderId ? (
                    <span className="text-xs px-2 py-1 bg-neem/20 text-neem inline-flex items-center gap-1">
                      <Check className="w-3 h-3" /> RECOVERED
                    </span>
                  ) : c.optedOut ? (
                    <span className="text-xs px-2 py-1 bg-mitti/20 text-mitti">OPTED OUT</span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-haldi/30 text-haldi inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> ACTIVE
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: any) {
  return (
    <div className={`p-5 ${accent ? 'bg-kohl text-ivory' : 'bg-beige text-kohl'}`}>
      <p className={`label ${accent ? 'text-banarasi' : 'text-mitti'}`}>{label}</p>
      <p className="font-display text-3xl mt-2">{value}</p>
    </div>
  );
}

function ago(d: Date): string {
  const diff = Date.now() - d.getTime();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
