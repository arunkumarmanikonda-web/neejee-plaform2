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
      eyebrow: 'OPERATIONS',
      title: 'Customers',
      description: 'Search customer accounts, investigate support context, and resume account-level follow-up.',
      href: '/admin/customers',
      cta: 'OPEN CUSTOMERS →',
    },
    {
      eyebrow: 'CATALOG',
      title: 'Categories',
      description: 'Jump into taxonomy and storefront category controls when navigation or classification needs attention.',
      href: '/admin/categories',
      cta: 'OPEN CATEGORIES →',
    },
    {
      eyebrow: 'GROWTH',
      title: 'Analytics',
      description: 'Open reporting and KPI surfaces quickly when operators need performance context without live dashboard widgets.',
      href: '/admin/analytics',
      cta: 'OPEN ANALYTICS →',
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

  const secondaryControlLinks = [
    { label: 'Disputes', href: '/admin/disputes' },
    { label: 'Reviews', href: '/admin/reviews' },
    { label: 'Inventory', href: '/admin/inventory' },
    { label: 'Trial Balance', href: '/admin/finance/trial-balance' },
    { label: 'Marketing Studio', href: '/admin/marketing-studio' },
    { label: 'Team & Roles', href: '/admin/team' },
  ] as const;

  const safeModeSummaryItems = [
    {
      value: String(controlCenterCards.length),
      label: 'Primary destinations',
      detail: 'High-value admin surfaces pinned in the control center.',
    },
    {
      value: String(secondaryControlLinks.length),
      label: 'Secondary routes',
      detail: 'Recovery-safe links for adjacent operational workflows.',
    },
    {
      value: 'Ctrl / Cmd + K',
      label: 'Palette fallback',
      detail: 'Global command access remains available from anywhere in admin.',
    },
  ] as const;

  const safeModeRouteGroups = [
    {
      name: 'Operations',
      count: '6 routes',
      detail: 'Orders, disputes, customers, segments, and reviews remain reachable during safe-mode recovery.',
    },
    {
      name: 'Growth',
      count: '8 routes',
      detail: 'Analytics, campaigns, forecasting, approvals, and recovery marketing tools remain grouped together.',
    },
    {
      name: 'Catalog',
      count: '11 routes',
      detail: 'Products, categories, inventory, media tooling, drops, and merchandising stay easy to scan.',
    },
    {
      name: 'Marketplace',
      count: '9 routes',
      detail: 'Seller, vendor, agreement, onboarding, and purchase-order flows remain visible as one domain.',
    },
    {
      name: 'ERP',
      count: '4 routes',
      detail: 'Sync, reconciliation, failure handling, and ERP entry points remain clearly separated.',
    },
    {
      name: 'Finance',
      count: '6 routes',
      detail: 'P&L, trial balance, reconciliation, and payout reporting remain grouped for finance operators.',
    },
    {
      name: 'Content',
      count: '8 routes',
      detail: 'SEO, CMS, taxonomy, banners, badges, assets, journal, and AI tooling stay discoverable.',
    },
    {
      name: 'Admin',
      count: '6 routes',
      detail: 'Team, legal, notification, SMS, profile, and settings controls remain available in safe mode.',
    },
  ] as const;

  const safeModePriorityWorkstreams = [
    {
      title: 'Order response',
      tag: 'OPERATIONS',
      detail: 'Keep order review, dispute triage, and moderation recovery paths close together during safe mode.',
      routes: [
        { label: 'Orders', href: '/admin/orders' },
        { label: 'Disputes', href: '/admin/disputes' },
        { label: 'Reviews', href: '/admin/reviews' },
      ],
    },
    {
      title: 'Catalog upkeep',
      tag: 'CATALOG',
      detail: 'Pin the most common catalog maintenance surfaces for edits, taxonomy work, and stock follow-up.',
      routes: [
        { label: 'Products', href: '/admin/products' },
        { label: 'Categories', href: '/admin/categories' },
        { label: 'Inventory', href: '/admin/inventory' },
      ],
    },
    {
      title: 'Growth studio',
      tag: 'GROWTH',
      detail: 'Keep reporting, campaign planning, and creative drafting visible from one recovery-safe lane.',
      routes: [
        { label: 'Analytics', href: '/admin/analytics' },
        { label: 'Campaigns', href: '/admin/campaigns' },
        { label: 'Marketing Studio', href: '/admin/marketing-studio' },
      ],
    },
    {
      title: 'Finance close',
      tag: 'FINANCE',
      detail: 'Group fast access to finance reporting and trial-balance review when live dashboard metrics are unavailable.',
      routes: [
        { label: 'P&L', href: '/admin/finance/pnl' },
        { label: 'Trial Balance', href: '/admin/finance/trial-balance' },
        { label: 'ERP', href: '/admin/erp' },
      ],
    },
    {
      title: 'Marketplace control',
      tag: 'MARKETPLACE',
      detail: 'Keep seller operations and adjacent admin controls visible for onboarding and coordination workflows.',
      routes: [
        { label: 'Sellers', href: '/admin/sellers' },
        { label: 'Team & Roles', href: '/admin/team' },
        { label: 'Settings', href: '/admin/settings' },
      ],
    },
    {
      title: 'Content + search',
      tag: 'CONTENT',
      detail: 'Retain content visibility and a clear search fallback when operators need broader admin reach quickly.',
      routes: [
        { label: 'SEO', href: '/admin/seo' },
        { label: 'Ctrl / Cmd + K', href: '/admin' },
      ],
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

        <div className="bg-white border border-mitti/15 rounded-xl px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="label text-madder mr-2">SAFE MODE SECONDARY ROUTES</p>
            {secondaryControlLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-lg border border-mitti/15 bg-ivory font-ui text-xs text-kohl hover:text-madder hover:border-madder/20 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="label text-madder">SAFE MODE COVERAGE</p>
          <div className="grid md:grid-cols-3 gap-4">
            {safeModeSummaryItems.map((item) => (
              <div key={item.label} className="bg-white border border-mitti/15 rounded-xl px-5 py-4">
                <p className="font-display text-2xl text-kohl">{item.value}</p>
                <p className="font-ui text-sm text-kohl mt-2 font-medium">{item.label}</p>
                <p className="font-ui text-xs text-mitti mt-2 leading-5">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="label text-madder">SAFE MODE ROUTE GROUPS</p>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {safeModeRouteGroups.map((group) => (
              <div key={group.name} className="bg-beige border border-mitti/10 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-ui text-sm text-kohl font-medium">{group.name}</p>
                  <span className="px-2 py-1 rounded-full bg-white border border-mitti/15 font-ui text-[11px] text-madder">
                    {group.count}
                  </span>
                </div>
                <p className="font-ui text-xs text-mitti mt-3 leading-5">{group.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="label text-madder">SAFE MODE PRIORITY WORKSTREAMS</p>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {safeModePriorityWorkstreams.map((item) => (
              <div key={item.title} className="bg-white border border-mitti/15 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-ui text-sm text-kohl font-medium">{item.title}</p>
                  <span className="px-2 py-1 rounded-full bg-beige border border-mitti/10 font-ui text-[11px] text-madder">
                    {item.tag}
                  </span>
                </div>
                <p className="font-ui text-xs text-mitti mt-3 leading-5">{item.detail}</p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {item.routes.map((route) => (
                    <Link
                      key={route.label}
                      href={route.href}
                      className="px-2.5 py-1.5 rounded-full bg-ivory border border-mitti/15 font-ui text-[11px] text-kohl hover:text-madder hover:border-madder/20 transition-colors"
                    >
                      {route.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="font-ui text-xs text-mitti leading-6">
          Customers, categories, analytics, campaigns, SEO, ERP, finance reporting, seller operations, catalog work, platform settings, additional recovery-safe routes, grouped route coverage, and priority workstreams now stay visible from one dashboard zone.
        </p>
      </section>
    </>
  );
}