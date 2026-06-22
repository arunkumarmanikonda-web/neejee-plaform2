'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, User, Landmark, FolderOpen, Clock,
  HelpCircle, Wallet, Users, Activity, Settings, Menu, X, Upload, Sparkles, Receipt,
} from 'lucide-react';

const NAV_MAIN = [
  { href: '/seller/dashboard',         label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/seller/inventory',         label: 'Inventory',         icon: Package, badgeKey: 'submissionsNeedingInfoCount' as const },
  { href: '/seller/inventory/submit',  label: 'Submit Product',    icon: Upload },
  { href: '/seller/orders',            label: 'Orders & Sales',    icon: ShoppingBag },
  { href: '/seller/payouts',           label: 'Payouts',           icon: Wallet },
  // v23.40.6 — commission invoices billed by NEEJEE (two-way recon)
  { href: '/seller/commissions',       label: 'Commissions',       icon: Receipt },
  { href: '/seller/profile',           label: 'Studio Profile',    icon: User },
  { href: '/seller/bank',              label: 'Bank Account',      icon: Landmark },
  { href: '/seller/documents',         label: 'Documents',         icon: FolderOpen },
  { href: '/seller/change-requests',   label: 'Pending Changes',   icon: Clock, badgeKey: 'pendingChangeRequestsCount' as const },
];

const NAV_ACCOUNT = [
  { href: '/seller/team',     label: 'Team Members', icon: Users,    ownerOnly: true },
  { href: '/seller/account',  label: 'Account',      icon: Settings },
  { href: '/seller/activity', label: 'Activity Log', icon: Activity },
  { href: '/seller/help',     label: 'Help',         icon: HelpCircle },
];

export default function SellerSidebar({
  sellerName, sellerStatus, isNeejeeSelect, isOwner,
  pendingChangeRequestsCount, submissionsNeedingInfoCount,
}: {
  sellerName: string;
  sellerStatus: string;
  isNeejeeSelect: boolean;
  isOwner: boolean;
  pendingChangeRequestsCount: number;
  submissionsNeedingInfoCount: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const badges = { pendingChangeRequestsCount, submissionsNeedingInfoCount };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 bg-kohl text-ivory p-2 rounded"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-kohl/60 backdrop-blur-sm"
          aria-label="Close menu"
        />
      )}

      <aside className={`bg-kohl text-ivory p-6 h-screen overflow-y-auto flex flex-col
        fixed top-0 left-0 z-50 w-72 transform transition-transform md:translate-x-0 md:sticky
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between md:block">
          <Link href="/seller/dashboard" className="block">
            <p className="font-display text-xl text-ivory tracking-wider">NEEJEE</p>
            <p className="font-italic italic text-beige/70 text-xs">studio portal</p>
          </Link>
          <button onClick={() => setMobileOpen(false)} className="md:hidden text-ivory">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio identity card */}
        <div className="mt-6 pb-5 border-b border-mitti/40">
          <p className="label text-banarasi text-[10px]">YOUR STUDIO</p>
          <p className="font-display text-base text-ivory mt-1 truncate">{sellerName}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] tracking-widest px-1.5 py-0.5 rounded ${
              sellerStatus === 'APPROVED'
                ? 'bg-emerald-700/30 text-emerald-200'
                : 'bg-banarasi/30 text-banarasi'
            }`}>{sellerStatus}</span>
            {isNeejeeSelect && (
              <span className="flex items-center gap-1 text-[10px] tracking-widest text-madder">
                <Sparkles className="w-3 h-3" /> SELECT
              </span>
            )}
          </div>
        </div>

        <nav className="mt-6 space-y-6 flex-1 font-ui text-sm">
          <div>
            <p className="label text-banarasi/70 mb-2 text-[10px]">MAIN WORK</p>
            <div className="space-y-1">
              {NAV_MAIN.map(item => {
                const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                const badge = item.badgeKey ? (badges as any)[item.badgeKey] : 0;
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                      active
                        ? 'bg-mitti text-ivory'
                        : 'text-beige/80 hover:bg-mitti/40 hover:text-ivory'
                    }`}>
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span className="bg-banarasi text-kohl text-[10px] font-display px-1.5 py-0.5 rounded">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="label text-banarasi/70 mb-2 text-[10px]">ACCOUNT</p>
            <div className="space-y-1">
              {NAV_ACCOUNT.filter(i => isOwner || !i.ownerOnly).map(item => {
                const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link key={item.href} href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                      active
                        ? 'bg-mitti text-ivory'
                        : 'text-beige/80 hover:bg-mitti/40 hover:text-ivory'
                    }`}>
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        <form action="/api/auth/logout" method="POST" className="pt-6 border-t border-mitti/30 mt-6">
          <button type="submit" className="flex items-center gap-2 font-ui text-xs text-beige/70 hover:text-madder transition-colors">
            <X className="w-3 h-3" /> SIGN OUT
          </button>
        </form>
      </aside>
    </>
  );
}
