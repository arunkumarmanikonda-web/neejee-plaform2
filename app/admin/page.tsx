import { getSession } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const QUICK_LINKS = [
  { href: '/admin/products', label: 'PRODUCTS', desc: 'Edit catalogue, pricing, media, and curation.' },
  { href: '/admin/orders', label: 'ORDERS', desc: 'Review recent orders and fulfillment activity.' },
  { href: '/admin/customers', label: 'CUSTOMERS', desc: 'Search customers, segments, and account activity.' },
  { href: '/admin/categories', label: 'CATEGORIES', desc: 'Manage taxonomy and category placement.' },
  { href: '/admin/analytics', label: 'ANALYTICS', desc: 'Open reporting pages when database capacity allows.' },
  { href: '/admin/ai-photo-studio', label: 'AI PHOTO STUDIO', desc: 'Run creative and catalogue media workflows.' },
];

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

      <div className="mt-6 bg-madder/10 p-4 font-ui text-sm text-madder space-y-2">
        <p>
          This page intentionally avoids Prisma queries. Use the quick links below to continue working while the production pool recovers or the database connection mode is adjusted.
        </p>
        <p>
          If a linked page still fails, retry once in a fresh tab. Product editing, catalogue drafting, and save flows should be tested directly from the Products section.
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-10">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-beige p-8 hover:bg-white transition-colors border border-mitti/10"
          >
            <p className="label text-madder">{item.label}</p>
            <p className="font-ui text-sm text-mitti mt-3 leading-6">{item.desc}</p>
            <p className="font-ui text-xs text-madder mt-6">OPEN →</p>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <div className="bg-beige p-8">
          <p className="label text-madder">RECOMMENDED NEXT STEP</p>
          <p className="font-ui text-sm text-mitti mt-3 leading-6">
            Open Products first, then edit the target item directly. This bypasses the heavy dashboard queries and gets you back into the catalogue workflow faster.
          </p>
          <Link href="/admin/products" className="font-ui text-xs text-madder hover:underline mt-6 inline-block">
            GO TO PRODUCTS →
          </Link>
        </div>

        <div className="bg-beige p-8">
          <p className="label text-madder">WHY THIS PAGE LOOKS DIFFERENT</p>
          <p className="font-ui text-sm text-mitti mt-3 leading-6">
            The previous dashboard attempted several live database reads and could still trigger connection exhaustion. This safe-mode version removes those reads completely so the admin shell remains available.
          </p>
          <Link href="/admin/orders" className="font-ui text-xs text-madder hover:underline mt-6 inline-block">
            OPEN ORDERS →
          </Link>
        </div>
      </div>
    </>
  );
}
