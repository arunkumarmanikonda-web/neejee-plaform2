'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, FileSpreadsheet, User, Landmark, FolderOpen, Clock, HelpCircle,
  Wallet, Users, Activity, Settings, Menu, X, BookOpen, Camera,
} from 'lucide-react';

const NAV_MAIN = [
  { href: '/vendor/dashboard',        label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/vendor/purchase-orders',  label: 'Purchase Orders',  icon: FileSpreadsheet },
  { href: '/vendor/catalog',          label: 'Rate Card',        icon: BookOpen },
  { href: '/vendor/ai-photos',        label: 'AI Photo Studio',  icon: Camera },
  { href: '/vendor/payouts',          label: 'Payouts',          icon: Wallet },
  { href: '/vendor/profile',          label: 'Profile',          icon: User },
  { href: '/vendor/bank',             label: 'Bank Account',     icon: Landmark },
  { href: '/vendor/documents',        label: 'Documents',        icon: FolderOpen },
  { href: '/vendor/change-requests',  label: 'Pending Changes',  icon: Clock, badgeKey: 'pendingChangeRequestsCount' as const },
];

const NAV_ACCOUNT = [
  { href: '/vendor/team',     label: 'Team Members', icon: Users },
  { href: '/vendor/account',  label: 'Account',      icon: Settings },
  { href: '/vendor/activity', label: 'Activity Log', icon: Activity },
  { href: '/vendor/help',     label: 'Help',         icon: HelpCircle },
];

export default function VendorSidebar({
  vendorName, vendorStatus, pendingChangeRequestsCount,
}: { vendorName: string; vendorStatus: string; pendingChangeRequestsCount: number }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <>
      {/* Mobile menu button — only on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 bg-kohl text-ivory p-2 rounded"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-kohl/60"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-60 bg-kohl text-beige border-r border-mitti/30 flex-col z-50 transition-transform ${
          mobileOpen ? 'flex translate-x-0' : '-translate-x-full md:translate-x-0 md:flex'
        }`}
      >
        <div className="px-5 py-6 border-b border-mitti/20 flex items-start justify-between">
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight text-ivory truncate">{vendorName}</p>
            <p className="text-[10px] uppercase tracking-widest text-mitti mt-1">
              Vendor · <span className={vendorStatus === 'ACTIVE' ? 'text-haldi' : 'text-mitti'}>{vendorStatus}</span>
            </p>
          </div>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-ivory" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          <SidebarSection items={NAV_MAIN} pendingChangeRequestsCount={pendingChangeRequestsCount} onItemClick={() => setMobileOpen(false)} />
          <div className="my-3 border-t border-mitti/20" />
          <SidebarSection items={NAV_ACCOUNT} pendingChangeRequestsCount={pendingChangeRequestsCount} onItemClick={() => setMobileOpen(false)} />
        </nav>
        <div className="px-5 py-4 border-t border-mitti/20 text-[10px] text-beige/60">
          <p className="font-display text-sm text-ivory">NEE<span className="text-madder">·</span>JEE</p>
          <p className="italic mt-1">Found. Personal.</p>
        </div>
      </aside>
    </>
  );
}

function SidebarSection({
  items, pendingChangeRequestsCount, onItemClick,
}: {
  items: Array<{ href: string; label: string; icon: any; badgeKey?: string }>;
  pendingChangeRequestsCount: number;
  onItemClick: () => void;
}) {
  const pathname = usePathname();
  const badges: Record<string, number> = { pendingChangeRequestsCount };
  return (
    <>
      {items.map(item => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname?.startsWith(item.href + '/');
        const badge = item.badgeKey ? badges[item.badgeKey] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onItemClick}
            className={`flex items-center justify-between gap-2 px-3 py-2 text-sm font-ui ${
              active ? 'bg-ivory/10 text-ivory' : 'text-beige/80 hover:text-ivory hover:bg-ivory/5'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {item.label}
            </span>
            {badge > 0 && (
              <span className="text-[10px] bg-madder text-ivory px-2 py-0.5 rounded-full">{badge}</span>
            )}
          </Link>
        );
      })}
    </>
  );
}
