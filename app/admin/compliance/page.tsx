// Compliance index — quick links to TDS, e-invoice, vendor catalog
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function CompliancePage() {
  const cards = [
    {
      href: '/admin/compliance/tds',
      title: 'TDS Certificates (Form 16A)',
      body: 'Quarterly vendor TDS statements. Generate, issue, record TRACES filing.',
    },
    {
      href: '/admin/compliance/einvoice',
      title: 'GST e-Invoice (IRN)',
      body: 'Track Invoice Reference Numbers issued by the NIC IRP for B2B orders.',
    },
    {
      href: '/admin/vendors',
      title: 'Vendor Catalog (rate-cards)',
      body: 'Manage per-vendor SKU rate-cards for fast purchase-order line creation.',
    },
  ];
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Compliance</h1>
        <p className="text-sm text-charcoal/60 mt-1">
          TDS, GST e-invoicing, vendor catalogues — Indian tax-compliance utilities for the finance team.
        </p>
      </header>
      <div className="grid md:grid-cols-3 gap-4">
        {cards.map(c => (
          <Link
            key={c.href}
            href={c.href}
            className="block border border-charcoal/10 p-5 hover:bg-beige/30"
          >
            <div className="font-display text-lg">{c.title}</div>
            <p className="text-xs text-charcoal/60 mt-2">{c.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
