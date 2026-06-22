import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  LayoutDashboard, Package, ShoppingBag, Users, FileText, Store, Sparkles, Settings,
  LogOut, Ticket, Warehouse, UserCog, User, Star, BarChart3, Megaphone, Mail, Target,
  Image as ImageIcon, Tag as TagIcon, Gem, Truck, FileSpreadsheet, Building2, Clock, Bell,
  Wallet, ShieldCheck, MessageSquareWarning, TrendingUp, Camera, MessageSquare, Wrench, Lock,
  BookOpen, Banknote,
} from 'lucide-react';
import { NeejeeLogo } from '@/components/brand/Logo';
import { getSession, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NAV_GROUPS = [
  {
    label: 'OPERATIONS',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/admin/disputes', label: 'Disputes', icon: MessageSquareWarning },
      { href: '/admin/customers', label: 'Customers', icon: Users },
      { href: '/admin/customers/segments', label: 'Segments', icon: Target },
      { href: '/admin/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    label: 'GROWTH',
    items: [
      { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/admin/forecast', label: 'Demand Forecast', icon: TrendingUp },
      { href: '/admin/loyalty', label: "Founder's Circle", icon: Gem },
      { href: '/admin/campaigns', label: 'Campaigns', icon: Megaphone },
      { href: '/admin/marketing', label: 'Email Broadcasts', icon: Mail },
      { href: '/admin/abandoned', label: 'Abandoned Carts', icon: ShoppingBag },
      { href: '/admin/marketing-studio', label: 'Marketing Studio', icon: Sparkles },
      { href: '/admin/marketing-approvals', label: 'Marketing Approvals', icon: Clock },
    ],
  },
  {
    label: 'CATALOG',
    items: [
      { href: '/admin/products', label: 'Products', icon: Package },
      { href: '/admin/categories', label: 'Categories', icon: TagIcon },
      { href: '/admin/crafts', label: 'Crafts', icon: Sparkles },
      { href: '/admin/ai-photo-studio', label: 'AI Photo Studio', icon: Camera },
      { href: '/admin/ai-photo-requests', label: 'Vendor Photo Queue', icon: Camera },
      { href: '/admin/inventory', label: 'Inventory', icon: Warehouse },
      { href: '/admin/drops', label: 'Drops', icon: Sparkles },
      { href: '/admin/waitlist', label: 'Waitlist', icon: TagIcon },
      { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
    ],
  },
  {
    label: 'MARKETPLACE',
    items: [
      { href: '/admin/sellers', label: 'Sellers', icon: Store },
      { href: '/admin/seller-inventory', label: 'Seller Inventory Queue', icon: Package },
      { href: '/admin/seller-change-requests', label: 'Seller Changes', icon: Clock },
      { href: '/admin/vendors', label: 'Vendors', icon: Truck },
      { href: '/admin/vendor-change-requests', label: 'Vendor Changes', icon: Clock },
      { href: '/admin/purchase-orders', label: 'Purchase Orders', icon: FileSpreadsheet },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { href: '/admin/cms', label: 'CMS Pages', icon: FileText },
      { href: '/admin/taxonomy', label: 'Taxonomy', icon: FileSpreadsheet },
      { href: '/admin/journal', label: 'Journal (auto)', icon: Sparkles },
      { href: '/admin/banners', label: 'Banners', icon: TagIcon },
      { href: '/admin/badges', label: 'Seals & Badges', icon: TagIcon },
      { href: '/admin/assets', label: 'Asset Library', icon: ImageIcon },
      { href: '/admin/ai', label: 'AI Manager', icon: Sparkles },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { href: '/admin/finance', label: 'Dashboard', icon: Wallet },
      { href: '/admin/finance/pnl', label: 'P&L Report', icon: BarChart3 },
      // v23.40.21 — Ledgers hub (index of every ledger surface)
      { href: '/admin/finance/ledgers', label: 'Ledgers Hub', icon: BookOpen },
      // v23.40.3 — accounting & ledgers
      { href: '/admin/finance/ledger', label: 'General Ledger', icon: FileText },
      { href: '/admin/finance/trial-balance', label: 'Trial Balance', icon: BarChart3 },
      { href: '/admin/finance/cash-bank-ledger', label: 'Cash / Bank Ledger', icon: Banknote },
      // v23.40.5 — revenue layer
      { href: '/admin/finance/sales-invoices', label: 'Sales Invoices', icon: FileText },
      { href: '/admin/finance/revenue-ledger', label: 'Revenue Ledger', icon: TrendingUp },
      // v23.40.6 — commission billing
      { href: '/admin/finance/commission',     label: 'Commission Billing', icon: Wallet },
      { href: '/admin/finance/bills', label: 'Bills (AP)', icon: FileSpreadsheet },
      { href: '/admin/finance/expenses', label: 'Expenses', icon: FileSpreadsheet },
      { href: '/admin/finance/vendor-ledger',    label: 'Vendor Ledgers',   icon: FileText },
      { href: '/admin/finance/customer-ledger',  label: 'Customer Ledgers', icon: Users },
      { href: '/admin/finance/aging', label: 'AP / AR Aging', icon: Clock },
      { href: '/admin/finance/bank-reconciliation', label: 'Bank Reco', icon: Building2 },
      { href: '/admin/payroll', label: 'Payroll', icon: UserCog },
      { href: '/admin/finance/recurring', label: 'Recurring', icon: Clock },
      { href: '/admin/finance/period-close', label: 'Period Close + GST', icon: Lock },
      { href: '/admin/finance/categories', label: 'Categories', icon: TagIcon },
      { href: '/admin/finance/ai-summary', label: 'AI Briefings', icon: Sparkles },
      { href: '/admin/finance/vendor-payouts', label: 'Vendor Payouts', icon: Wallet },
      { href: '/admin/finance/seller-payouts', label: 'Seller Payouts', icon: Wallet },
      // v23.40.9 — one-off data migrations (vendor links + order → invoice backfill)
      { href: '/admin/finance/backfill',       label: 'Backfill Tools', icon: Wrench },
      { href: '/admin/compliance', label: 'Compliance', icon: ShieldCheck },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { href: '/admin/team', label: 'Team & Roles', icon: UserCog },
      { href: '/admin/legal-entity', label: 'Legal Entity', icon: Building2 },
      { href: '/admin/notifications', label: 'Notification Logs', icon: Bell },
      { href: '/admin/settings/sms', label: 'SMS & OTP', icon: MessageSquare },
      { href: '/admin/profile', label: 'My Profile', icon: User },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!requireRole(user, ['ADMIN', 'SUPER_ADMIN', 'CONTENT_EDITOR', 'QC_TEAM', 'FINANCE', 'FINANCE_OPERATOR', 'MARKETING_OPERATOR', 'MARKETING_MANAGER'])) {
    redirect('/login?next=/admin');
  }

  const displayName = user!.name?.trim() || user!.email.split('@')[0];
  const roleLabel = user!.role.replace(/_/g, ' ');

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr] bg-ivory">
      <aside className="bg-kohl text-ivory p-6 sticky top-0 h-screen overflow-y-auto flex flex-col">
        <Link href="/" aria-label="NEEJEE Home">
          <NeejeeLogo size="md" variant="ivory" />
        </Link>
        <p className="font-italic italic text-beige text-sm mt-2">Admin</p>

        <nav className="mt-8 space-y-6 flex-1 font-ui text-sm">
          {NAV_GROUPS.map(g => (
            <div key={g.label}>
              <p className="label text-banarasi mb-2">{g.label}</p>
              <div className="space-y-1">
                {g.items.map(item => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded text-beige/80 hover:bg-mitti/40 hover:text-ivory transition-colors">
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="pt-6 border-t border-mitti/30 mt-6">
          <p className="label text-banarasi">SIGNED IN AS</p>
          <p className="font-italic italic text-beige mt-1 truncate">{displayName}</p>
          <p className="font-ui text-[10px] text-beige/60 tracking-widest mt-1">{roleLabel}</p>
          <p className="font-ui text-[10px] text-beige/40 tracking-widest mt-1 truncate">{user!.email}</p>
          <form action="/api/auth/logout" method="POST" className="mt-3">
            <button type="submit" className="flex items-center gap-2 font-ui text-xs text-beige/70 hover:text-madder transition-colors">
              <LogOut className="w-3 h-3" /> SIGN OUT
            </button>
          </form>
        </div>
      </aside>
      <main className="p-12 overflow-x-auto">{children}</main>
    </div>
  );
}
