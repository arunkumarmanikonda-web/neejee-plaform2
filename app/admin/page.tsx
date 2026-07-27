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

  const controlCenterCards = [
    {
      eyebrow: 'CATALOG',
      title: 'Products',
      description: 'Go directly into product CRUD, pricing, media, and day-to-day catalog edits.',
      href: '/admin/products',
      cta: 'OPEN PRODUCTS →',
    },
    {
      eyebrow: 'OPERATIONS',
      title: 'Orders',
      description: 'Resume order review, fulfillment checks, and operational exceptions quickly.',
      href: '/admin/orders',
      cta: 'OPEN ORDERS →',
    },
    {
      eyebrow: 'MARKETPLACE',
      title: 'Sellers',
      description: 'Continue seller review, onboarding, and marketplace control workflows.',
      href: '/admin/sellers',
      cta: 'OPEN SELLERS →',
    },
    {
      eyebrow: 'CONTENT',
      title: 'SEO',
      description: 'Reach the SEO control plane for metadata, canonical, and indexation work.',
      href: '/admin/seo',
      cta: 'OPEN SEO →',
    },
    {
      eyebrow: 'ERP',
      title: 'ERP',
      description: 'Jump into ERP monitoring, reconciliation, and failure-handling surfaces.',
      href: '/admin/erp',
      cta: 'OPEN ERP →',
    },
    {
      eyebrow: 'FINANCE',
      title: 'P&L',
      description: 'Open finance reporting fast when live dashboard metrics are unavailable.',
      href: '/admin/finance/pnl',
      cta: 'OPEN P&L →',
    },
    {
      eyebrow: 'GROWTH',
      title: 'Campaigns',
      description: 'Keep campaign planning and execution close while broader growth tooling evolves.',
      href: '/admin/campaigns',
      cta: 'OPEN CAMPAIGNS →',
    },
    {
      eyebrow: 'ADMIN',
      title: 'Settings',
      description: 'Access platform controls, integration settings, and operational configuration.',
      href: '/admin/settings',
      cta: 'OPEN SETTINGS →',
    },
  ] as const;

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

      <section className="mt-10 space-y-4">
        <div>
          <p className="label text-madder">SAFE MODE CONTROL CENTER</p>
          <h2 className="font-display text-2xl text-kohl mt-1">
            Stable destinations while live metrics stay offline
          </h2>
          <p className="font-ui text-sm text-mitti mt-3 leading-6 max-w-3xl">
            These links keep the highest-value admin surfaces one click away while the dashboard avoids heavy production queries.
          </p>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
          {controlCenterCards.map((card) => (
            <div key={card.href} className="bg-beige p-8 rounded-xl border border-mitti/10">
              <p className="label text-madder">{card.eyebrow}</p>
              <p className="font-ui text-base text-kohl mt-3 font-medium">{card.title}</p>
              <p className="font-ui text-sm text-mitti mt-3 leading-6">{card.description}</p>
              <Link href={card.href} className="font-ui text-xs text-madder hover:underline mt-6 inline-block">
                {card.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="font-ui text-xs text-mitti leading-6">
          Campaigns, SEO, ERP, finance reporting, seller operations, catalog work, and platform settings now stay visible from one safe-mode dashboard zone.
        </p>
      </section>
    </>
  );
}