import { getSession } from '@/lib/auth';
import Link from 'next/link';
import AdminAdaptiveQuickActions from '@/components/admin/AdminAdaptiveQuickActions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminDashboard() {
  const user = await getSession();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const displayName = user?.name || user?.email?.split('@')[0] || 'Admin';

  return (
    <>
      <p className="label text-madder">DASHBOARD · SAFE MODE</p>
      <h1 className="font-display text-4xl text-kohl mt-2">
        {greeting}, {displayName}.
      </h1>
      <p className="font-italic italic text-mitti text-lg mt-2">
        The database pool is saturated in production, so this overview page is temporarily running without live metrics to keep admin access usable.
      </p>
      <div className="madder-divider mt-4"></div>

      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white border border-mitti/15 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="label text-madder">ADMIN COMMAND PALETTE</p>
            <p className="font-ui text-sm text-mitti mt-2 leading-6">
              Press Ctrl/Cmd + K anywhere in admin to jump to pages, settings, reports, sellers, products, finance destinations, and direct utility actions.
            </p>
          </div>
          <div className="px-3 py-2 rounded-lg border border-mitti/20 bg-ivory font-mono text-xs text-kohl">
            Ctrl / Cmd + K
          </div>
        </div>

        <div className="bg-white border border-mitti/15 rounded-xl px-5 py-4">
          <p className="label text-madder">AOS-004 CONTEXT</p>
          <p className="font-ui text-sm text-mitti mt-2 leading-6">
            Quick actions are now tuned by recent usage, current workflow area, and admin role so the next step is more obvious without opening broad navigation first.
          </p>
        </div>
      </div>

      <div className="mt-6 bg-madder/10 p-4 font-ui text-sm text-madder space-y-2 rounded-xl">
        <p>
          This page intentionally avoids Prisma queries. Use the adaptive quick actions below to continue working while the production pool recovers or the database connection mode is adjusted.
        </p>
        <p>
          The dashboard now combines learned behavior with page-aware and role-aware suggestions so common admin flows stay closer to the operator.
        </p>
      </div>

      <AdminAdaptiveQuickActions user={user} />

      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <div className="bg-beige p-8 rounded-xl">
          <p className="label text-madder">RECOMMENDED NEXT STEP</p>
          <p className="font-ui text-sm text-mitti mt-3 leading-6">
            Open Products first, then edit the target item directly. This bypasses the heavy dashboard queries and gets you back into the catalogue workflow faster.
          </p>
          <Link href="/admin/products" className="font-ui text-xs text-madder hover:underline mt-6 inline-block">
            GO TO PRODUCTS →
          </Link>
        </div>

        <div className="bg-beige p-8 rounded-xl">
          <p className="label text-madder">ERP WORKFLOWS</p>
          <p className="font-ui text-sm text-mitti mt-3 leading-6">
            ERP monitoring, reconciliation, and dead-letter handling are grouped under a single control panel so the team can enter the full workflow from one visible admin location.
          </p>
          <Link href="/admin/erp" className="font-ui text-xs text-madder hover:underline mt-6 inline-block">
            OPEN ERP CONTROL PANEL →
          </Link>
        </div>
      </div>
    </>
  );
}