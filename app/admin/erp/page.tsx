import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ERP_LINKS = [
  {
    href: '/admin/erp/dashboard',
    label: 'SYNC DASHBOARD',
    desc: 'Watch queue health, recent attempts, dead-letter pressure, and throughput trends.',
  },
  {
    href: '/admin/erp/failures',
    label: 'FAILURE QUEUE',
    desc: 'Review dead-letter items, schedule retries, and mark failures resolved after investigation.',
  },
  {
    href: '/admin/erp/reconciliation',
    label: 'RECONCILIATION',
    desc: 'Compare platform catalogue truth against ERP product, price, and stock snapshots.',
  },
];

export default function AdminErpHomePage() {
  return (
    <>
      <p className="label text-madder">ERP CONTROL PANEL</p>
      <h1 className="font-display text-4xl text-kohl mt-2">Unified ERP admin panel</h1>
      <p className="font-italic italic text-mitti text-lg mt-2">
        Use this hub to move between sync observability, dead-letter handling, and
        reconciliation workflows without relying on hidden direct URLs.
      </p>
      <div className="madder-divider mt-4"></div>

      <div className="mt-6 bg-madder/10 p-4 font-ui text-sm text-madder space-y-2">
        <p>
          This ERP home page is intentionally lightweight. It acts as the single
          navigation surface for operational ERP work and points into the detailed
          pages that already exist in admin.
        </p>
        <p>
          Recommended workflow: start with the dashboard for queue health, move to the
          failure queue for action, and use reconciliation when validating catalogue
          truth across platform and ERP snapshots.
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 mt-10">
        {ERP_LINKS.map((item) => (
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
            Open the sync dashboard first to see overall queue health and recent ERP
            activity. If anything is failing, jump straight into the failure queue to
            schedule retries or mark items resolved.
          </p>
          <Link
            href="/admin/erp/dashboard"
            className="font-ui text-xs text-madder hover:underline mt-6 inline-block"
          >
            GO TO DASHBOARD →
          </Link>
        </div>

        <div className="bg-beige p-8">
          <p className="label text-madder">WHAT THIS AREA COVERS</p>
          <p className="font-ui text-sm text-mitti mt-3 leading-6">
            ERP monitoring, dead-letter queue operations, and reconciliation drift
            reporting now live under one admin section so operators no longer need to
            know individual route paths in advance.
          </p>
          <Link
            href="/admin/erp/reconciliation"
            className="font-ui text-xs text-madder hover:underline mt-6 inline-block"
          >
            OPEN RECONCILIATION →
          </Link>
        </div>
      </div>
    </>
  );
}
