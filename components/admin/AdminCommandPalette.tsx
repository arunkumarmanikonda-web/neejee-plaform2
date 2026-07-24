'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  Command,
  CornerDownLeft,
  Search,
  Sparkles,
} from 'lucide-react';

type CommandItem = {
  href: string;
  label: string;
  group: string;
  desc: string;
  keywords: string[];
};

const COMMAND_ITEMS: CommandItem[] = [
  { href: '/admin', label: 'Overview', group: 'Operations', desc: 'Admin landing page and safe-mode dashboard.', keywords: ['dashboard', 'overview', 'home', 'admin'] },
  { href: '/admin/orders', label: 'Orders', group: 'Operations', desc: 'Review recent orders and fulfillment activity.', keywords: ['orders', 'fulfillment', 'shipping'] },
  { href: '/admin/disputes', label: 'Disputes', group: 'Operations', desc: 'Review dispute cases and interventions.', keywords: ['disputes', 'claims', 'cases'] },
  { href: '/admin/customers', label: 'Customers', group: 'Operations', desc: 'Search customers and account activity.', keywords: ['customers', 'accounts', 'users'] },
  { href: '/admin/customers/segments', label: 'Segments', group: 'Operations', desc: 'Audience segmentation and lifecycle targeting.', keywords: ['segments', 'cohorts', 'audience'] },
  { href: '/admin/reviews', label: 'Reviews', group: 'Operations', desc: 'Moderate product and customer reviews.', keywords: ['reviews', 'ratings', 'ugc'] },

  { href: '/admin/analytics', label: 'Analytics', group: 'Growth', desc: 'Reporting and performance pages.', keywords: ['analytics', 'reports', 'metrics', 'kpi'] },
  { href: '/admin/forecast', label: 'Demand Forecast', group: 'Growth', desc: 'Demand forecast workspace.', keywords: ['forecast', 'demand', 'prediction'] },
  { href: '/admin/loyalty', label: "Founder's Circle", group: 'Growth', desc: 'Loyalty configuration and activity.', keywords: ['loyalty', 'members', 'rewards'] },
  { href: '/admin/campaigns', label: 'Campaigns', group: 'Growth', desc: 'Campaign planning and control.', keywords: ['campaigns', 'marketing', 'growth'] },
  { href: '/admin/marketing', label: 'Email Broadcasts', group: 'Growth', desc: 'Email broadcast and messaging workflows.', keywords: ['email', 'broadcasts', 'newsletter'] },
  { href: '/admin/abandoned', label: 'Abandoned Carts', group: 'Growth', desc: 'Recovery flows and abandoned-cart monitoring.', keywords: ['abandoned', 'carts', 'recovery'] },
  { href: '/admin/marketing-studio', label: 'Marketing Studio', group: 'Growth', desc: 'Creative drafting and campaign production.', keywords: ['studio', 'creative', 'assets'] },
  { href: '/admin/marketing-approvals', label: 'Marketing Approvals', group: 'Growth', desc: 'Approval queue for marketing outputs.', keywords: ['approvals', 'marketing', 'review'] },

  { href: '/admin/products', label: 'Products', group: 'Catalog', desc: 'Product CRUD, pricing, media, and edits.', keywords: ['products', 'catalog', 'sku', 'pricing'] },
  { href: '/admin/catalogues', label: 'Catalogues', group: 'Catalog', desc: 'Catalogue generation and exports.', keywords: ['catalogues', 'catalogs', 'exports', 'pdf'] },
  { href: '/admin/merchandising', label: 'Merchandising', group: 'Catalog', desc: 'Curated launch and catalogue merchandising.', keywords: ['merchandising', 'launches', 'curation'] },
  { href: '/admin/categories', label: 'Categories', group: 'Catalog', desc: 'Taxonomy and storefront categories.', keywords: ['categories', 'taxonomy', 'navigation'] },
  { href: '/admin/crafts', label: 'Crafts', group: 'Catalog', desc: 'Craft definitions and editorial organization.', keywords: ['crafts', 'heritage', 'taxonomy'] },
  { href: '/admin/ai-photo-studio', label: 'AI Photo Studio', group: 'Catalog', desc: 'AI-assisted catalogue media workflows.', keywords: ['photo', 'studio', 'images', 'ai'] },
  { href: '/admin/ai-photo-requests', label: 'Vendor Photo Queue', group: 'Catalog', desc: 'Vendor media intake and requests.', keywords: ['photo queue', 'vendor photos', 'media requests'] },
  { href: '/admin/inventory', label: 'Inventory', group: 'Catalog', desc: 'Inventory visibility and stock admin.', keywords: ['inventory', 'stock', 'warehouse'] },
  { href: '/admin/drops', label: 'Drops', group: 'Catalog', desc: 'Drop planning and merchandising windows.', keywords: ['drops', 'launch', 'release'] },
  { href: '/admin/waitlist', label: 'Waitlist', group: 'Catalog', desc: 'Waitlist and demand-intent monitoring.', keywords: ['waitlist', 'back in stock', 'lead'] },
  { href: '/admin/coupons', label: 'Coupons', group: 'Catalog', desc: 'Coupon setup and campaign incentives.', keywords: ['coupons', 'offers', 'discounts'] },

  { href: '/admin/sellers', label: 'Sellers', group: 'Marketplace', desc: 'Seller records, review, and controls.', keywords: ['sellers', 'marketplace', 'vendors'] },
  { href: '/admin/agreements', label: 'Agreements', group: 'Marketplace', desc: 'Agreement records and review.', keywords: ['agreements', 'contracts', 'signing'] },
  { href: '/admin/legal-signatories', label: 'Legal Signatories', group: 'Marketplace', desc: 'Company signatories and legal setup.', keywords: ['legal signatories', 'signers', 'legal'] },
  { href: '/admin/seller-onboarding', label: 'Seller Onboarding', group: 'Marketplace', desc: 'Onboarding and verification workspace.', keywords: ['seller onboarding', 'kyc', 'activation'] },
  { href: '/admin/seller-inventory', label: 'Seller Inventory Queue', group: 'Marketplace', desc: 'Seller inventory intake queue.', keywords: ['seller inventory', 'queue', 'submissions'] },
  { href: '/admin/seller-change-requests', label: 'Seller Changes', group: 'Marketplace', desc: 'Seller change request review.', keywords: ['seller changes', 'change requests', 'review'] },
  { href: '/admin/vendors', label: 'Vendors', group: 'Marketplace', desc: 'Vendor records and controls.', keywords: ['vendors', 'purchase', 'supplier'] },
  { href: '/admin/vendor-change-requests', label: 'Vendor Changes', group: 'Marketplace', desc: 'Vendor change request queue.', keywords: ['vendor changes', 'approvals'] },
  { href: '/admin/purchase-orders', label: 'Purchase Orders', group: 'Marketplace', desc: 'PO flows and supplier handling.', keywords: ['purchase orders', 'po', 'procurement'] },

  { href: '/admin/erp', label: 'ERP Home', group: 'ERP', desc: 'ERP control panel and navigation root.', keywords: ['erp', 'integration', 'sync'] },
  { href: '/admin/erp/dashboard', label: 'Sync Dashboard', group: 'ERP', desc: 'ERP sync overview.', keywords: ['sync dashboard', 'erp dashboard'] },
  { href: '/admin/erp/failures', label: 'Failure Queue', group: 'ERP', desc: 'ERP dead-letter and failure handling.', keywords: ['failures', 'queue', 'dead letter'] },
  { href: '/admin/erp/reconciliation', label: 'Reconciliation', group: 'ERP', desc: 'ERP reconciliation workflow.', keywords: ['reconciliation', 'erp'] },

  { href: '/admin/cms', label: 'CMS Pages', group: 'Content', desc: 'CMS page management.', keywords: ['cms', 'pages', 'content'] },
  { href: '/admin/taxonomy', label: 'Taxonomy', group: 'Content', desc: 'Taxonomy management tools.', keywords: ['taxonomy', 'content', 'hierarchy'] },
  { href: '/admin/journal', label: 'Journal (auto)', group: 'Content', desc: 'Journal automation workspace.', keywords: ['journal', 'editorial', 'content'] },
  { href: '/admin/banners', label: 'Banners', group: 'Content', desc: 'Banner asset management.', keywords: ['banners', 'hero', 'creative'] },
  { href: '/admin/badges', label: 'Seals & Badges', group: 'Content', desc: 'Badge asset management.', keywords: ['badges', 'seals', 'labels'] },
  { href: '/admin/assets', label: 'Asset Library', group: 'Content', desc: 'Asset library and media browsing.', keywords: ['assets', 'media', 'library'] },
  { href: '/admin/ai', label: 'AI Manager', group: 'Content', desc: 'AI management and utility pages.', keywords: ['ai manager', 'prompts', 'tools'] },

  { href: '/admin/team', label: 'Team & Roles', group: 'Admin', desc: 'Role and team administration.', keywords: ['team', 'roles', 'permissions'] },
  { href: '/admin/legal-entity', label: 'Legal Entity', group: 'Admin', desc: 'Legal entity setup and company metadata.', keywords: ['legal entity', 'company details'] },
  { href: '/admin/notifications', label: 'Notification Logs', group: 'Admin', desc: 'Notification log review.', keywords: ['notifications', 'logs', 'messages'] },
  { href: '/admin/settings/sms', label: 'SMS & OTP', group: 'Admin', desc: 'SMS, OTP, sender, and template controls.', keywords: ['sms', 'otp', 'fast2sms', 'templates'] },
  { href: '/admin/profile', label: 'My Profile', group: 'Admin', desc: 'Current admin profile settings.', keywords: ['profile', 'my account'] },
  { href: '/admin/settings', label: 'Settings', group: 'Admin', desc: 'Core admin settings and configuration.', keywords: ['settings', 'config', 'preferences'] },
];

export default function AdminCommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const hotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (hotkey) {
        event.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setCursor(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = COMMAND_ITEMS
      .filter((item) => item.href !== pathname)
      .map((item) => {
        const haystack = [item.label, item.group, item.desc, item.href, ...item.keywords].join(' ').toLowerCase();
        let score = 0;
        if (!q) score = 1;
        else {
          if (item.label.toLowerCase().includes(q)) score += 8;
          if (item.group.toLowerCase().includes(q)) score += 4;
          if (item.href.toLowerCase().includes(q)) score += 3;
          if (item.desc.toLowerCase().includes(q)) score += 2;
          if (item.keywords.some((keyword) => keyword.toLowerCase().includes(q))) score += 5;
          if (haystack.includes(q)) score += 1;
        }
        return { ...item, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 12);
    return items;
  }, [pathname, query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const active = results[cursor];

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <div className="sticky top-0 z-20 -mx-2 px-2 pb-6 bg-gradient-to-b from-ivory via-ivory to-transparent">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full bg-white border border-mitti/15 rounded-xl px-4 py-3 flex items-center justify-between gap-4 shadow-sm hover:border-madder/30 transition-colors"
        >
          <span className="flex items-center gap-3 min-w-0">
            <Search className="w-4 h-4 text-madder shrink-0" />
            <span className="text-sm text-kohl text-left truncate">
              Search admin pages, settings, reports, sellers, products, and actions
            </span>
          </span>
          <span className="flex items-center gap-2 text-[11px] text-mitti shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-banarasi" />
            <span className="hidden sm:inline">COMMAND PALETTE</span>
            <span className="px-2 py-1 rounded border border-mitti/20 bg-ivory font-mono">Ctrl K</span>
          </span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 bg-kohl/35 backdrop-blur-[1px] px-4 py-8 sm:px-8">
          <div className="max-w-3xl mx-auto bg-ivory border border-mitti/15 shadow-2xl rounded-2xl overflow-hidden">
            <div className="border-b border-mitti/15 px-5 py-4 bg-white">
              <div className="flex items-center gap-3">
                <Search className="w-4 h-4 text-madder" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setCursor((v) => Math.min(v + 1, Math.max(results.length - 1, 0)));
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setCursor((v) => Math.max(v - 1, 0));
                    }
                    if (e.key === 'Enter' && active) {
                      e.preventDefault();
                      go(active.href);
                    }
                  }}
                  placeholder="Search pages, settings, reports, users, sellers, products..."
                  className="w-full bg-transparent outline-none text-kohl placeholder:text-mitti text-sm"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs tracking-wider text-mitti hover:text-madder"
                >
                  ESC
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-3 bg-ivory">
              {results.length ? (
                <div className="space-y-2">
                  {results.map((item, index) => {
                    const isActive = index === cursor;
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => go(item.href)}
                        className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                          isActive
                            ? 'border-madder bg-madder/10'
                            : 'border-transparent bg-white hover:border-mitti/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="label text-madder">{item.group}</p>
                            <p className="text-sm text-kohl mt-2 font-medium">{item.label}</p>
                            <p className="text-xs text-mitti mt-1 leading-5">{item.desc}</p>
                            <p className="text-[11px] text-mitti/80 mt-2 font-mono">{item.href}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-mitti mt-1 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-mitti/15 p-6">
                  <p className="label text-madder">NO MATCHES</p>
                  <p className="text-sm text-mitti mt-3 leading-6">
                    Try broader keywords like products, settings, sellers, analytics, inventory, or sms.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-mitti/15 px-5 py-3 bg-white flex flex-wrap items-center gap-4 text-[11px] text-mitti">
              <span className="flex items-center gap-1"><Command className="w-3.5 h-3.5" /> Ctrl/Cmd + K</span>
              <span>↑ ↓ to move</span>
              <span className="flex items-center gap-1"><CornerDownLeft className="w-3.5 h-3.5" /> Enter to open</span>
              <span>Esc to close</span>
              <Link href="/admin/settings" className="ml-auto text-madder hover:underline">
                OPEN SETTINGS →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}