// Branded portal layout for all signed-in seller pages.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SellerSidebar from '@/components/seller/SellerSidebar';
import { NeejeeLogo } from '@/components/brand/Logo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/seller/login');

  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  if (!isAdmin && user.role !== 'SELLER' && user.role !== 'SELLER_STAFF') {
    redirect('/login?error=not_a_seller');
  }

  // Resolve the seller for this user. Keep this select limited to columns known
  // to exist in production so legacy Prisma schema drift cannot break login.
  let seller: any = null;
  let isOwner = false;

  try {
    if (user.role === 'SELLER') {
      seller = await prisma.seller.findFirst({
        where: { userId: user.id },
        select: {
          id: true,
          businessName: true,
          kycStatus: true,
          isNeejeeSelect: true,
          autoKycSummary: true,
        },
      });
      isOwner = true;
    } else if (user.role === 'SELLER_STAFF') {
      const tm = await prisma.sellerTeamMember.findFirst({
        where: { userId: user.id, status: 'ACTIVE' },
        include: {
          seller: {
            select: {
              id: true,
              businessName: true,
              kycStatus: true,
              isNeejeeSelect: true,
              autoKycSummary: true,
            },
          },
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

  if (!seller && !isAdmin) {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-6 text-center">
        <NeejeeLogo size="lg" />
        <p className="label text-madder mt-10">ALMOST THERE</p>
        <h1 className="font-display text-4xl text-kohl mt-3">
          Your studio portal opens once we approve your application.
        </h1>
        <p className="font-italic italic text-mitti mt-3 max-w-md mx-auto">
          We're personally reviewing your application and KYC dossier. You'll receive an email when the next onboarding stage is ready.
        </p>
        <Link href="/" className="btn-primary mt-8 inline-block">RETURN HOME</Link>
      </div>
    );
  }

  // Defence in depth for legacy accounts that may still carry a SELLER role.
  // Operational seller access is never valid unless the Seller record itself is approved.
  if (seller && !isAdmin && String(seller.kycStatus) !== 'APPROVED') {
    return (
      <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-6 text-center">
        <NeejeeLogo size="lg" />
        <p className="label text-madder mt-10">APPLICATION UNDER REVIEW</p>
        <h1 className="font-display text-4xl text-kohl mt-3 max-w-2xl">
          Your Seller Studio is not active yet.
        </h1>
        <p className="font-italic italic text-mitti mt-3 max-w-xl mx-auto">
          NEEJEE is reviewing your seller application. We will write to your communication email if we need a clarification and will send secure activation instructions after approval.
        </p>
        <Link href="/" className="btn-primary mt-8 inline-block">RETURN HOME</Link>
      </div>
    );
  }

  // New seller applications use a controlled activation lifecycle:
  // approval -> account activation -> agreement review/signing -> NEEJEE
  // countersign/finalisation -> full Seller Studio. Legacy sellers that pre-date
  // applicationSubmittedAt are not unexpectedly locked by this rollout.
  if (seller && !isAdmin) {
    const summary = asObject(seller.autoKycSummary);
    const onboarding = asObject(summary.onboarding);
    const workflow = asObject(summary.agreementWorkflow);
    const isModernApplication = Boolean(String(onboarding.applicationSubmittedAt || '').trim());
    const workflowStatus = String(workflow.status || '').trim().toUpperCase();
    const agreementClosed = workflowStatus === 'CLOSED';

    if (isModernApplication && !agreementClosed) {
      const signingUrl = String(workflow.sellerSigningUrl || '').trim();
      const sellerSignedAt = String(workflow.sellerSignedAt || '').trim();
      const companySignedAt = String(workflow.companySignedAt || '').trim();

      let eyebrow = 'AGREEMENT ONBOARDING';
      let title = 'Your Seller Studio onboarding is in progress.';
      let message = 'NEEJEE is preparing your seller agreement and commercial terms. You can use the secure agreement link here as soon as it is issued.';

      if (signingUrl && !sellerSignedAt) {
        eyebrow = 'AGREEMENT READY';
        title = 'Review and sign your NEEJEE seller agreement.';
        message = 'Your application is approved and your Seller Studio account is active. Review the agreement carefully and complete the seller signature step to continue.';
      } else if (sellerSignedAt && !companySignedAt) {
        eyebrow = 'SELLER SIGNATURE RECEIVED';
        title = 'Your agreement is with NEEJEE for countersignature.';
        message = 'Your signature has been recorded. NEEJEE will complete the company-signature and finalisation steps in the Agreement Workbench.';
      } else if (sellerSignedAt && companySignedAt) {
        eyebrow = 'FINALISATION IN PROGRESS';
        title = 'Both signatures are complete.';
        message = 'NEEJEE is closing the agreement workflow. Full marketplace operations will unlock once the agreement is marked closed.';
      }

      return (
        <div className="min-h-screen bg-ivory flex flex-col items-center justify-center px-6 text-center">
          <NeejeeLogo size="lg" />
          <p className="label text-madder mt-10">{eyebrow}</p>
          <h1 className="font-display text-4xl text-kohl mt-3 max-w-2xl">{title}</h1>
          <p className="font-italic italic text-mitti mt-3 max-w-xl mx-auto">{message}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {signingUrl && !sellerSignedAt ? (
              <a href={signingUrl} className="btn-primary inline-block">
                REVIEW & SIGN AGREEMENT
              </a>
            ) : null}
            <Link href="/" className="px-5 py-3 border border-mitti/30 text-kohl text-sm tracking-wide">
              RETURN HOME
            </Link>
          </div>
          <p className="text-xs text-mitti mt-6 max-w-xl">
            Marketplace catalogue, inventory, orders and payouts remain locked until the seller agreement is fully executed and finalised.
          </p>
        </div>
      );
    }
  }

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
