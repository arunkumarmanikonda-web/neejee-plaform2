import { getSession } from '@/lib/auth';
import { readSellerOnboardingSession } from '@/lib/seller-onboarding/application-session';

const INTERNAL_KYC_ROLES = new Set([
  'ADMIN',
  'SUPER_ADMIN',
  'QC_TEAM',
  'FINANCE',
  'FINANCE_OPERATOR',
]);

export async function hasKycVerificationAccess(expectedPhone?: string | null) {
  const onboarding = await readSellerOnboardingSession(expectedPhone || undefined);
  if (onboarding) return true;

  const session = await getSession();
  return Boolean(session && INTERNAL_KYC_ROLES.has(session.role));
}
