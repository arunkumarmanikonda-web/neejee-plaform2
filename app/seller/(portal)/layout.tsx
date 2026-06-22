// Branded portal layout for all signed-in seller pages.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SellerSidebar from '@/components/seller/SellerSidebar';
import { NeejeeLogo } from '@/components/brand/Logo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/seller/login');

  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  if (!isAdmin && user.role !== 'SELLER' && user.role !== 'SELLER_STAFF') {
    redirect('/login?error=not_a_seller');
  }

  // Resolve the seller for this user
  let seller: any = null;
  let isOwner = false;

  try {
    if (user.role === 'SELLER') {
      seller = await prisma.seller.findFirst({
        where: { userId: user.id },
        select: { id: true, businessName: true, kycStatus: true, isNeejeeSelect: true, slug: true },
      });
      isOwner = true;
    } else if (user.role === 'SELLER_STAFF') {
      const tm = await prisma.sellerTeamMember.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        include: {
          seller: { select: { id: true, businessName: true, kycStatus: true, isNeejeeSelect: true, slug: true } },
        },
      });
      if (tm) {
        seller = tm.seller;
        isOwner = false;
      }
    }
  } catch (e) {
    console.error('[seller.portal.layout]', e);
  }

  // No seller record (or onboarding incomplete) → holding screen
  if (!seller && !isAdmin) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-6 text-center">
        <NeejeeLogo size="lg" />
        <p className="label text-madder mt-10">ALMOST THERE</p>
        <h1 className="font-display text-4xl text-kohl mt-3">
          Your studio portal opens once we approve your application.
        </h1>
        <p className="font-italic italic text-mitti mt-3 max-w-md mx-auto">
          We're personally reviewing your craft and portfolio. You'll receive an email once your studio is live.
        </p>
        <Link href="/" className="btn-primary mt-8 inline-block">RETURN HOME</Link>
      </div>
    );
  }

  // Best-effort badge counts
  let pendingChangeRequestsCount = 0;
  let submissionsNeedingInfoCount = 0;
  if (seller) {
    try {
      [pendingChangeRequestsCount, submissionsNeedingInfoCount] = await Promise.all([
        prisma.sellerChangeRequest.count({ where: { sellerId: seller.id, status: 'PENDING' } }),
        prisma.sellerInventorySubmission.count({ where: { sellerId: seller.id, status: 'NEEDS_INFO' } }),
      ]);
    } catch { /* migration not run yet — show zeros */ }
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[288px_1fr] bg-ivory">
      <SellerSidebar
        sellerName={seller?.businessName || 'NEEJEE Admin'}
        sellerStatus={seller?.kycStatus || 'ADMIN'}
        isNeejeeSelect={!!seller?.isNeejeeSelect}
        isOwner={isOwner}
        pendingChangeRequestsCount={pendingChangeRequestsCount}
        submissionsNeedingInfoCount={submissionsNeedingInfoCount}
      />
      <main className="md:p-10 p-6 pt-16 md:pt-10 overflow-x-auto">{children}</main>
    </div>
  );
}
