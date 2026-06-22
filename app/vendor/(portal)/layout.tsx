// Shared layout for the authenticated vendor portal — branded header + sidebar.
// Public routes (/vendor/login, /vendor) stay outside this group so they keep
// their own full-screen layout.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NeejeeLogo } from '@/components/brand/Logo';
import VendorSidebar from '@/components/vendor/VendorSidebar';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function VendorPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/vendor/login');
  if (session.role !== 'VENDOR') redirect('/vendor/login');

  const vendor = await prisma.vendor.findUnique({
    where: { userId: session.id },
    select: { id: true, legalName: true, displayName: true, status: true },
  });
  if (!vendor) redirect('/vendor/login');

  const pendingChangeRequestsCount = await prisma.vendorChangeRequest.count({
    where: { vendorId: vendor.id, status: 'PENDING' },
  });

  return (
    <div className="min-h-screen bg-beige flex">
      {/* Sidebar (sticky on desktop, drawer on mobile) */}
      <VendorSidebar
        vendorName={vendor.displayName || vendor.legalName}
        vendorStatus={vendor.status}
        pendingChangeRequestsCount={pendingChangeRequestsCount}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-0">
        {/* Top brand bar */}
        <header className="bg-ivory border-b border-mitti/15 px-6 py-3 flex items-center justify-between">
          <Link href="/vendor/dashboard" className="flex items-center gap-3">
            <NeejeeLogo className="h-7" />
            <span className="hidden md:inline text-[10px] uppercase tracking-[0.3em] text-mitti">Vendor Portal</span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/vendor/help" className="text-mitti hover:text-madder">Help</Link>
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="text-mitti hover:text-madder">Sign out</button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>

        <footer className="bg-ivory border-t border-mitti/15 px-6 py-3 text-[10px] text-mitti flex justify-between">
          <span>© NEEJEE. Personally received.</span>
          <span>Questions? <a href="mailto:partners@neejee.com" className="text-madder hover:underline">partners@neejee.com</a></span>
        </footer>
      </div>
    </div>
  );
}
